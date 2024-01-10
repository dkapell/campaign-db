'use strict';
const async = require('async');
const config = require('config');
const _ = require('underscore');
const moment = require('moment');
const models = require('./models');
const skillHelper = require('./skillHelper');
const characterRenderer = require('./renderer/character');
const campaignHelper = require('./campaignHelper');

class Character{
    constructor(options){
        this.options = options;
        if (_.has(options, 'id')){
            this.id = options.id;
        }
        if (_.has(options, 'showAll')){
            this.showAll = options.showAll;
        }
        if (_.has(options, 'noRestrictions')){
            this.noRestrictions = options.noRestrictions;
            this.showAll = options.showAll;
        }
    }

    async init(){
        const self = this;
        if (self.options.cloneId){
            await self.clone(self.options.cloneId, self.options.user_id);
        } else if (!self.options.id){
            await self.create(self.options);
        }
        self._data = await models.character.get(self.id);
    }

    async create(data){
        const self = this;
        if (!data.name){
            throw new Error ('Name must be specified for new character');
        }
        if (!data.user_id){
            throw new Error ('User must be specified for new character');
        }
        const doc = {
            name: data.name,
            user_id: data.user_id,
            cp:0,
            campaign_id: data.campaign_id
        };

        if (_.has(data, 'extra_traits')){
            doc.extra_traits = data.extra_traits;
        }

        self.id = await models.character.create(doc);
        self._data = doc;
        console.log(`Created character ${self.id}: ${data.name}`);

        const sources = (await models.skill_source.find({campaign_id: data.campaign_id, required:true})).sort(skillHelper.sourceSorter);

        for (const source of sources){
            await self.addSource(source.id, true);
        }
        return self.calculateCP();
    }

    async update(data){
        const self = this;
        const doc = {};
        if (_.has(data, 'name')){
            doc.name = data.name;
        }
        if (_.has(data, 'user_id')){
            doc.user_id = data.user_id;
        }
        if (_.has(data, 'extra_traits')){
            doc.extra_traits = data.extra_traits;
        }
        await models.character.update(self.id, doc);
        self._data = await models.character.get(self.id);
        console.log(`Update character ${self.id}: ${data.name}`);
    }

    async clone(sourceCharacterId, userId, campaignId){
        const self = this;
        const sourceCharacter = await models.character.get(sourceCharacterId);
        if (!sourceCharacter || sourceCharacter.campaign_id !== campaignId){
            throw new Error('Invalid Source Character');
        }
        sourceCharacter.name = `Copy of ${sourceCharacter.name}`;
        sourceCharacter.updated = new Date();
        sourceCharacter.active = false;
        if (userId){
            console.log('setting id to ' + userId);
            sourceCharacter.user_id = userId;
        }
        self.id = await models.character.create(sourceCharacter);
        const sources = await models.character_skill_source.find({character_id:sourceCharacterId});
        for (const source of sources){
            source.character_id = self.id;
            source.updated = new Date();
            await models.character_skill_source.create(source);
        }
        const skills = await models.character_skill.find({character_id:sourceCharacterId});
        for (const skill of skills){
            skill.character_id = self.id;
            skill.updated = new Date();
            await models.character_skill.create(skill);
        }
        console.log(`Cloned character ${self.id}: ${sourceCharacter.name} from ${sourceCharacterId}`);
    }

    async addSource(sourceId, skipCost){
        const self = this;
        const doc = {
            character_id: self.id,
            skill_source_id: sourceId
        };
        const character_source = await models.character_skill_source.findOne(doc);
        if (character_source){ return; }


        const skill_source = await models.skill_source.get(sourceId);
        if (skill_source.campaign_id != self._data.campaign_id){
            return;
        }

        if (!(self.showAll || skill_source.display_to_pc)){
            return;
        }

        if (skill_source.type.num_free){
            const sourceCount = (_.where(await self.sources(), {type_id: skill_source.type_id})).length;
            if (sourceCount < skill_source.type.num_free){
                doc.cost = 0;
            } else {
                doc.cost = skill_source.cost;
            }
        } else {
            doc.cost = skill_source.cost;
        }

        console.log(`Adding Source ${skill_source.name} to ${self.name}: ${self.id}`);

        const characterSkillSourceId = await models.character_skill_source.create(doc);

        const skills = await models.skill.find({source_id: sourceId, required:true});
        for (const skill of skills){
            await self.addSkill(skill.id, null, true);
        }
        if (skipCost){ return characterSkillSourceId; }
        await self.calculateCP();
        return characterSkillSourceId;
    }

    async removeSource(sourceId, skipCost){
        const self = this;
        sourceId = Number(sourceId);

        const skills = _.where(await self.skills(), {source_id: sourceId});

        const removableSkills = skills.filter(skill => {
            return !skill.required;
        });

        if (removableSkills.length){
            throw new Error('Can\'t remove a source that still has skills');
        }

        const sources = await self.sources();
        for (const checkSource in sources){
            if (_.isArray(checkSource.requires) && _.indexOf(checkSource.requires, sourceId) !== -1){
                throw new Error('Can\'t remove a source that is required by other sources');
            }
        }

        const source = await self.source(sourceId);

        console.log(`Removing Source ${sourceId} from ${self.name}: ${self.id}`);
        await models.character_skill_source.delete({character_id:self.id, skill_source_id: sourceId});

        await async.each(skills, async(skill) => {
            console.log(`Removing Skill ${skill.name}: ${skill.id} from ${self.name}: ${self.id} (${skill.character_skill_id})`);
            return models.character_skill.delete(skill.character_skill_id);
        });

        if (source.type.num_free && !source.character_cost){
            // we got this one for free, so move that to another source
            const sources = await self.sources();
            const updateSource = _.findWhere(sources, {type_id: source.type_id});
            if (updateSource){
                await self.updateSourceCost(updateSource.id, 0, true);
            }
        }

        if (skipCost){ return; }
        return self.calculateCP();
    }

    async addSkill(skillId, details, skipCost){
        const self = this;

        const skill = await models.skill.get(skillId);
        // If the skill isn't PC visibible, don't add it.
        if (!skill.status.purchasable){
            return;
        }
        if (skill.campaign_id !== self._data.campaign_id){
            return;
        }

        const skillCosts = skill.cost.split(/\s*,\s*/);

        // check if the character already has a skill with the same name
        const allSkills = await self.skills();
        const existing = _.where(allSkills, {name: skill.name});
        if (existing.length === skillCosts.length){
            // already have the max number of skills with this name
            return;
        }

        const sources = await self.sources();
        if (!_.findWhere(sources, {id: skill.source_id})){
            throw new Error('Do not have the source for this skill');
        }

        const doc = {
            character_id: self.id,
            skill_id: skillId
        };
        const character_skills = await models.character_skill.find(doc);
        if (character_skills.length === skillCosts.length){
            // already have the max number of this skill
            return;
        }

        doc.cost = skillCosts[character_skills.length] || 0;

        if (details){
            doc.details = JSON.stringify(details);
        }
        console.log(`Adding Skill ${skill.name} to ${self.name}: ${self.id}`);

        const characterSkillId = await models.character_skill.create(doc);
        if (skipCost){ return characterSkillId; }
        await self.calculateCP();
        return characterSkillId;
    }

    async removeSkill(characterSkillId, skipCost){
        const self = this;

        const characterSkill = await models.character_skill.get(characterSkillId);
        if (!characterSkill) {
            throw new Error('Can not find skill to remove');
        }

        const source = await models.character_skill_source.find({character_id:self.id, skill_source_id:characterSkill.source_id});

        if (source && characterSkill.skill.required){
            throw new Error('Can not remove required skill');
        }
        const allSkills = await self.skills();

        const skillIds = [];
        let found = false;
        for (const skill of allSkills){
            if (!found && skill.id === characterSkill.skill.id){
                found = true;
                continue;
            }
            skillIds.push(skill.id);
        }

        found = 0;
        for (const skill of allSkills){
            if (!_.isArray(skill.requires)){
                continue;
            }
            for (const item of skill.requires){
                if (_.indexOf(skillIds, item) !== -1 ){
                    found++;
                }
            }
            if (found < skill.require_num){
                throw new Error(`"${skill.name}"" from ${skill.source.name} requires "${characterSkill.skill.name}"`);
            }
        }

        const doc = {
            character_id: self.id,
            skill_id: characterSkill.skill.id
        };
        const characterSkills = await models.character_skill.find(doc);

        const removedSkill = {
            id: characterSkillId,
            skill_id: characterSkill.skill.id
        };

        if (_.uniq(_.pluck(characterSkills, 'cost')).length !== 1){
            // If they cost different amounts, remove the most recent
            removedSkill.id = characterSkills[characterSkills.length-1].id;
        }
        console.log(`Removing Skill ${characterSkill.skill.name}: ${removedSkill.id} from ${self.name}: ${self.id}`);
        await models.character_skill.delete(removedSkill.id);

        if (skipCost){ return removedSkill;}
        await self.calculateCP();
        return removedSkill;
    }

    async updateSkillDetails(characterSkillId, details){
        const self = this;
        const characterSkill = await models.character_skill.get(characterSkillId);
        if (!characterSkill){
            return;
        }
        characterSkill.details = details;
        characterSkill.updated = new Date();
        await models.character_skill.update(characterSkillId, characterSkill);
        self._data = await models.character.get(self.id);
        self._data.updated = new Date();
        return models.character.update(self.id, self._data);
    }

    async data(){
        const self = this;
        self._data = await models.character.get(self.id);
        const doc = JSON.parse(JSON.stringify(self._data));
        doc.sources = await self.sources();
        doc.skills = await self.skills();
        doc.user = await models.user.get(self._data.campaign_id, self._data.user_id);

        doc.provides = await gatherProvides(doc.sources, false, null, self.id);
        doc.provides = await gatherProvides(doc.skills, true, doc.provides, self.id);
        const attributeList = await models.attribute.find({campaign_id:self._data.campaign_id});
        doc.provides.attributes = await self.prepAttributes(doc.provides.attributes);
        doc.provides.internalAttributes = [];
        for (const attribute of doc.provides.attributes){
            if (attribute.name.match(/^_/)){
                attribute.internal = true;
                attribute.name = capitalize(attribute.name.replace(/^_/,''));
                doc.provides.internalAttributes.push(attribute);
            }
        }
        doc.provides.attributes = doc.provides.attributes.filter(e => {
            return !e.internal;
        });

        doc.provides.attributes = await campaignHelper.attributeSorter(doc.provides.attributes, self.campaign_id);
        doc.provides.internalAttributes = await campaignHelper.attributeSorter(doc.provides.internalAttributes, self.campaign_id);

        if (self._data.extra_traits){
            if (!_.has(doc.provides.traits, 'Character')){
                doc.provides.traits.Character = [];
            }
            const traits = self._data.extra_traits.split(/\s*,\s*/);
            for (const trait of traits){
                doc.provides.traits.Character.push(trait);
            }
        }

        return doc;
    }

    async skills(){
        const self = this;
        const skills = await models.character_skill.find({character_id:self.id});
        const allSkills = JSON.parse(JSON.stringify(skills));
        return skills.map(skill => {
            const doc = skill.skill;
            delete doc.notes;
            doc.details = skill.details;
            doc.character_cost = skill.cost;
            doc.character_skill_id = skill.id;
            doc.character_updated = skill.updated;
            doc.removable = true;
            if (skill.required){
                doc.removable = false;
            } else {
                for (const checkSkill of allSkills){
                    if (_.isArray(checkSkill.skill.requires) && _.indexOf(checkSkill.skill.requires, skill.skill.id) !== -1){
                        doc.removable = false;
                    }
                }
            }

            return doc;
        }).sort(skillHelper.sorter);
    }

    async skill(characterSkillId){
        const self = this;
        const skill = await models.character_skill.get(characterSkillId);
        const doc = skill.skill;
        delete doc.notes;
        doc.details = skill.details;
        doc.character_cost = skill.cost;
        doc.character_skill_id = skill.id;
        doc.character_updated = skill.updated;
        doc.removable = true;
        if (skill.required){
            doc.removable = false;
        } else {
            const allSkills = await self.skills();
            for (const checkSkill of allSkills){
                if (_.isArray(checkSkill.requires) && _.indexOf(checkSkill.requires, skill.id) !== -1){
                    doc.removable = false;
                }
            }
        }
        return doc;
    }

    async sources(){
        const self = this;
        const sources = (await models.character_skill_source.find({character_id:self.id})).sort(skillHelper.sourceSorter);

        const allSources = JSON.parse(JSON.stringify(sources));
        const filledSouces = await async.mapLimit(sources, 3, async (source) => {
            const doc = source.skill_source;
            delete doc.notes;
            doc.character_cost = source.cost;
            doc.character_updated = source.updated;
            const skills = (await self.skills()).filter(skill => {
                return skill.source_id === source.skill_source_id;
            });

            doc.character_skills = skills;
            doc.removable = true;

            if (source.skill_source.required){
                doc.removable = false;
            } else {

                doc.removable = !(skills.filter(skill => {
                    return !skill.removable
                })).length;

                for (const checkSource of allSources){
                    if (_.isArray(checkSource.skill_source.requires) && _.indexOf(checkSource.skill_source.requires, source.skill_source.id) !== -1){
                        doc.removable = false;
                    }
                }
            }

            return doc;
        });

        return filledSouces.sort(skillHelper.sourceSorter);
    }

    async source(sourceId){
        const self = this;
        const source = await models.character_skill_source.findOne({character_id: self.id, skill_source_id:sourceId});
        if (!source) { return; }
        const doc = source.skill_source;
        delete doc.notes;
        doc.character_cost = source.cost;
        doc.character_updated = source.updated;
        const skills = (await self.skills()).filter(skill => {
            return skill.source_id === source.skill_source_id;
        });
        doc.character_skills = skills;

        if (source.skill_source.required){
            doc.removable = false;
        } else {
            doc.removable = !(skills.filter(skill => {
                return _.indexOf(skill.tags, 'required') === -1;
            })).length;
            const allSources = await self.sources();
            for (const checkSource of allSources){
                if (_.isArray(checkSource.requires) && _.indexOf(checkSource.requires, source.skill_source.id) !== -1){
                    doc.removable = false;
                }
            }
        }

        return doc;
    }

    async cp(){
        const self = this;
        self._data = await models.character.get(self.id);
        return self._data.cp;
    }

    async calculateCP(){
        const self = this;
        let cp = 0;
        const sources = await self.sources();
        for (const source of sources){
            cp += Number(source.character_cost);
        }
        const skills = await self.skills();
        for (const skill of skills){
            cp += Number(skill.character_cost);
        }
        self._data = await models.character.get(self.id);
        self._data.cp = cp;
        self._data.updated = new Date();
        return models.character.update(self.id, self._data);
    }

    async recalculateCP(skipCost){
        const self = this;
        let cp = 0;
        const charSources = _.groupBy(await self.sources(), 'type_id');
        for (const type in charSources){
            const sources = charSources[type];
            if (sources[0].type.num_free){
                const num_free = sources[0].type.num_free;
                for (let i = 0; i < Math.min(num_free, sources.length); i++){
                    const source = sources.pop();
                    await self.updateSourceCost(source.id, 0);

                }
            }
            for (const source of sources){
                if (Number(source.cost) !== Number(source.character_cost)){
                    await self.updateSourceCost(source.id, source.cost, true);
                }
            }
        }

        const charSkills = _.groupBy(await self.skills(), 'id');
        for (const id in charSkills){
            const skills = charSkills[id];

            for (let i = 0; i < skills.length; i++){
                const skill = skills[i];
                const skillCosts = skill.cost.split(/\s*,\s*/);
                const cost = skillCosts[i] || 0;
                if (Number(cost) !== Number(skill.character_cost)){
                    await self.updateSkillCost(skill.character_skill_id, cost, true);
                }
            }
        }
        if (skipCost) { return; }
        return self.calculateCP();
    }

    async updateSourceCost(sourceId, cost, skipCost){
        const self = this;
        const conditions = {
            character_id: self.id,
            skill_source_id: sourceId
        };
        const data = { cost: cost };
        console.log(`Setting Source ${sourceId} to ${cost} on ${self.name}: ${self.id}`);
        await models.character_skill_source.update(conditions, data);
        if (skipCost){ return; }
        return self.calculateCP();
    }

    async updateSkillCost(skillId, cost, skipCost){
        const self = this;
        const characterSkill = await models.character_skill.get(skillId);
        if (!characterSkill) { return; }
        characterSkill.cost = cost;
        console.log(`Setting Skill ${skillId} to ${cost} on ${self.name}: ${self.id}`);

        await models.character_skill.update(skillId, characterSkill);
        if (skipCost){ return; }
        return self.calculateCP();
    }

    async pdf(skillDescriptions, showLanguages){
        return characterRenderer(await this.data(), {
            skillDescriptions:skillDescriptions,
            showLanguages:showLanguages
        });
    }

    async possibleSkills(all){
        const self = this;
        const sources = await self.sources();
        const localSkills = await self.skills();

        let skills = [];
        await async.each(sources, async (source) => {
            const sourceSkills = await models.skill.find({source_id: source.id});
            for (const skill of sourceSkills){
                // Show all skills, if showAll, otherwise show purchasable and visible skills (or purchasable + all)
                if (!(self.showAll || (skill.status.purchasable && (all || skill.status.display_to_pc)))){
                    continue;
                }

                const matches = _.where(localSkills,  {name: skill.name});
                const skill_costs = skill.cost.split(/\s*,\s*/);
                if (matches.length >= skill_costs.length){
                    continue;
                }
                skill.next_cost = skill_costs[matches.length];

                if (_.isArray(skill.conflicts)){
                    for (const conflict of skill.conflicts){
                        if (_.findWhere(localSkills, {id: conflict} )){
                            continue;
                        }
                    }
                }

                if (_.isArray(skill.requires)){
                    let found = 0;
                    for (const item of skill.requires){
                        if (_.findWhere(localSkills, {id: item} )){
                            found++;
                        }
                    }
                    if (found < skill.require_num){
                        continue;
                    }
                }

                const existing = _.findWhere(skills, {name: skill.name});
                if (existing){
                    if (existing.cost < skill.cost){
                        continue;
                    }
                    skills = _.without(skills, existing);
                }

                skills.push(skill);
            }
            return;
        });

        return skills.sort(skillHelper.sorter);

    }
    async possibleSources(campaignId, all){
        const self = this;
        const sources = await models.skill_source.find({campaign_id:campaignId});
        const localSources = await self.sources();

        return sources.filter (source => {
            if (_.findWhere(localSources, {id: source.id} )){
                return false;
            }
            if (!(self.showAll || all || source.display_to_pc)){
                return false;
            }
            if (_.isArray(source.conflicts)){
                for (const conflict of source.conflicts){
                    if (_.findWhere(localSources, {id: conflict} )){
                        return false;
                    }
                }
            }
            if (_.isArray(source.requires)){
                let found = 0;
                for (const item of source.requires){
                    if (_.findWhere(localSources, {id: item} )){
                        found++;
                    }
                }
                if (found < source.require_num){
                    return false;
                }
            }
            return true;
        });
    }

    async activate(){
        const self = this;
        const user = await models.user.get(self._data.campaign_id, self._data.user_id);
        self._data = await models.character.get(self.id);
        if (self._data.active){
            return;
        }
        if (user.type === 'player'){
            const characters = await models.character.find({user_id: user.id});
            await async.each(characters, async (character) => {
                if (character.active){
                    character.active = false;
                    character.updated = new Date();
                    return models.character.update(character.id, character);
                }
            });
        }
        self._data = await models.character.get(self.id);
        self._data.active = true;
        self._data.updated = new Date();
        return models.character.update(self.id, self._data);
    }
    get name(){
        return this._data.name;
    }
    get active(){
        return this._data.active;
    }

    async _updateTimestamp(){
        const self = this;
        self._data = await models.character.get(self.id);
        self._data.updated = new Date();
        return models.character.update(self.id, self._data);
    }

    async audits(){
        const self = this;
        const audits = await models.audit.find({object_type: 'character', object_id: self.id});
        await async.each(audits, async (audit) => {
            audit.createdFormated = {
                day: moment(audit.created).format('ll'),
                hour: moment(audit.created).format('LT')
            };
            if (_.has(audit.data, 'skill')){
                audit.data.skill = await models.skill.get(audit.data.skill);
            } else if (_.has(audit.data, 'characterSkill')){
                const characterSkill = await models.character_skill.get(audit.data.characterSkill);
                if (characterSkill){
                    audit.data.skill = await models.skill.get(characterSkill.skill_id);
                } else {
                    audit.data.skill = {
                        name: 'Removed Skill'
                    };
                }
            }
            if (_.has(audit.data, 'source')){
                audit.data.source = await models.skill_source.get(audit.data.source);
            }
            if (_.has(audit.data, 'from')){
                audit.data.from = await models.character.get(audit.data.from);
            }
            if (_.has(audit.data, 'details')){
                audit.data.details = formatDetails(audit.data.details.old, audit.data.details.new);
            }
            if (audit.action === 'update'){
                audit.changes = formatUpdate(audit.data.old, audit.data.new);
            }
        });
        return audits;
    }

    async prepAttributes(characterAttributes){
        const self = this;
        const attributeList = await models.attribute.find({campaign_id:self._data.campaign_id});
        for (const attribute of attributeList){
            if (attribute.initial){
                if (_.has(characterAttributes, attribute.name)){
                    characterAttributes[attribute.name] += attribute.initial;
                } else {
                    characterAttributes[attribute.name] = attribute.initial;
                }
            }
            if (attribute.toughness){
                if (!_.has(characterAttributes, '_toughness')){
                    characterAttributes._toughness = 0;
                }
                if (_.has(characterAttributes, attribute.name)){
                    characterAttributes._toughness += characterAttributes[attribute.name];
                }
            }
        }

        const attributes = [];
        for (const attribute in characterAttributes){
            attributes.push({
                name: attribute,
                value: characterAttributes[attribute]
            });
        }
        return attributes;

    }
}

module.exports = Character;

async function gatherProvides (items, isSkills, provides, characterId){
    if (!provides){
        provides = {
            attributes: {},
            styles: {},
            traits: {},
            skills: [],
            languages: [],
            tagskills: [],
            diagnose: [],
            crafting: {}
        };
    }


    for (const item of items){

        if (_.isArray(item.provides) && item.provides.length){
            for (const provider of item.provides){
                switch (provider.type){
                    case 'attribute': {
                        let type = null;

                        if (provider.name && provider.name.match(/^\s*\[/)){
                            if (item.details && item.details.attribute){
                                type = item.details.attribute;
                            } else {
                                type = 'Unset User-Chosen Attribute';
                            }
                        } else {
                            type = provider.name;
                        }

                        if (!_.has(provides.attributes, type)){
                            provides.attributes[type] = 0;
                        }
                        provides.attributes[type] += Number(provider.value);

                        break;
                    }
                    case 'trait':
                        if (!_.has(provides.traits, provider.name)){
                            provides.traits[provider.name] = [];
                        }
                        if (provider.value === 'custom'){

                            if (item.details && item.details.trait){
                                provides.traits[provider.name].push(item.details.trait);
                            } else {
                                provides.traits[provider.name].push('Unset Custom Trait');
                            }
                        } else {

                            provides.traits[provider.name].push(provider.value);
                        }
                        break;
                    case 'style':{
                        let name = null;
                        let quantity = 1;
                        if (provider.value && provider.value.match(/^\s*\[/)){
                            if (item.details && item.details.style){
                                name = item.details.style;
                            } else {
                                name = 'Unset User-Chosen Weapon Style';
                            }
                        } else {
                            name = provider.value;
                        }

                        if (name.match(/|/)){
                            const parts = name.split(/\|/, 2);
                            name = parts[0];
                            quantity = Number(parts[1]);
                        }

                        if (!_.has(provides.styles, name)){
                            provides.styles[name] = quantity;
                        } else {
                            provides.styles[name] += quantity;
                        }
                        break;
                    }
                    case 'language':
                        if (provider.value && provider.value.match(/^\s*\[/)){
                            if (item.details && item.details.language){
                                provides.languages.push(item.details.language);
                            } else {
                                provides.languages.push('Unset User-Chosen Language');
                            }
                        } else {
                            provides.languages.push(provider.value);
                        }
                        break;
                    case 'tagskill':
                        if (provider.value && provider.value.match(/^\s*\[/)){
                            if (item.details && item.details.tagskill){
                                provides.tagskills.push(item.details.tagskill);
                            } else {
                                provides.tagskills.push('Unset User-Chosen Tag Skill');
                            }
                        } else {
                            provides.tagskills.push(provider.value);
                        }
                        break;
                    case 'diagnose': {
                        let type = null;

                        if (provider.value){
                            const traits = provider.value.split(/\s*,\s*/);
                            for(const trait of traits){
                                if (_.indexOf(provides.diagnose) === -1){
                                    provides.diagnose.push(trait);
                                }
                            }
                        }

                        break;
                    }
                    case 'crafting': {
                        const type = provider.name;

                        if (!_.has(provides.crafting, type)){
                            provides.crafting[type] = 0;
                        }
                        provides.crafting[type] += Number(provider.value);

                        break;
                    }
                    case 'skill': {
                        if (provider.value && provider.value.match(/^\s*\[/)){
                            if (item.details && item.details.skill){
                                const skill = await models.skill.findOne({name: item.details.skill});
                                if (skill){
                                    skill.fromOtherSkill = true;
                                    skill.character_cost = item.character_cost;
                                    skill.source = isSkills?item.source:item;
                                    items.push(skill);
                                    //provides.skills.push(skill);
                                } else {
                                    provides.skills.push(fakeSkill('Invalid User-Chosen Skill', item.name, isSkills?item.source.name:item.name));
                                }
                            } else {
                                provides.skills.push(fakeSkill('Unset User-Chosen Skill', item.name, isSkills?item.source.name:item.name));
                            }
                        } else if (isSkills){
                            provides.skills.push(item);
                        }
                        break;
                    }
                }
            }
        } else {
            if (isSkills){
                provides.skills.push(item);

            }
        }
    }
    return provides;
}

function fakeSkill(name, skillName, sourceName){
    return {
        id:null,
        name: name,
        tags:[],
        character_cost:0,
        cost: 0,
        description:'',
        summary: `Invalid Skill Selection from *${skillName}*`,
        source: {
            name: sourceName
        },
        usage: {
            name: 'Incomplete'
        }
    };
}


function extractProvides(skill){

}
function formatDetails(oldDetails, newDetails){
    const changes = [];
    for (const field in newDetails){
        if (newDetails[field]){
            if (!oldDetails || newDetails[field] !== oldDetails[field]){
                changes.push({
                    field: field,
                    type: 'field',
                    old: oldDetails?oldDetails[field]:null,
                    new: newDetails[field]
                });
            }

        } else if (!newDetails[field] && oldDetails && oldDetails[field]){
            changes.push({
                field: field,
                type: 'field',
                old: oldDetails?oldDetails[field]:null,
                new: newDetails[field]
            });
        }
    }
    return changes;
}

function formatUpdate(oldCharacter, newCharacter){
    const changes = [];
    for (const field of ['name']){
        if (newCharacter[field]){
            if (!oldCharacter || newCharacter[field] !== oldCharacter[field]){
                changes.push({
                    field: field,
                    type: 'field',
                    old: oldCharacter?oldCharacter[field]:null,
                    new: newCharacter[field]
                });
            }
        }
    }
    if (newCharacter.user_id){
        if (!oldCharacter || Number(newCharacter.user_id) !== Number(oldCharacter.user_id)){
            changes.push({
                field: 'user_id',
                type: 'field',
                old: oldCharacter?Number(oldCharacter.user_id):null,
                new: Number(newCharacter.user_id)
            });
        }
    }
    if (newCharacter.active){
        if (!oldCharacter || newCharacter.active !== oldCharacter.active){
            changes.push({
                field: 'active',
                type: 'field',
                old: oldCharacter?oldCharacter.active?'Yes':'No':null,
                new: newCharacter.active==='on'?'Yes':'No'
            });
        }
    } else {
        if (oldCharacter && oldCharacter.active){
            changes.push({
                field: 'active',
                type: 'field',
                old: oldCharacter?oldCharacter.active?'Yes':'No':null,
                new: newCharacter.active==='on'?'Yes':'No'
            });
        }
    }
    return changes;
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
