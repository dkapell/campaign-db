'use strict';

import async from 'async';
import _ from 'underscore';
import moment from 'moment';
import models from './models';
import skillHelper from './skillHelper';
import characterRenderer from './renderer/character';
import campaignHelper from './campaignHelper';
import cache from './cache';



class Character{
    id: number;
    showAll:boolean;
    options: CharacterOptions;
    noRestrictions: boolean;
    _data: CharacterData;

    constructor(options: CharacterOptions){
        this.options = options;
        if (_.has(options, 'id')){
            this.id = Number(options.id);
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
        if (this.options.cloneId){
            await this.clone(this.options.cloneId, this.options.user_id, this.options.campaign_id);
        } else if (!this.options.id){
            await this.create(this.options);
        }
        this._data = await models.character.get(this.id);
    }

    async create(data: CharacterData){
        if (!data.name){
            throw new Error ('Name must be specified for new character');
        }
        if (!data.user_id){
            throw new Error ('User must be specified for new character');
        }
        const doc: CharacterData = {
            name: data.name,
            user_id: data.user_id,
            cp:0,
            campaign_id: data.campaign_id,
            notes: data.notes,
            gm_notes: data.gm_notes
        };

        if (_.has(data, 'extra_traits')){
            doc.extra_traits = data.extra_traits;
        }
        if (_.has(data, 'pronouns')){
            doc.pronouns = data.pronouns;
        }

        this.id = await models.character.create(doc);
        this._data = doc;
        console.log(`Created character ${this.id}: ${data.name}`);

        if (_.has(data, 'custom_field')){
            const custom_fields = await models.custom_field.find({campaign_id:data.campaign_id, location:'character'});
            for (const field of custom_fields){
                const doc = {
                    character_id: this.id,
                    custom_field_id: field.id,
                    value: null
                };
                if (_.has(data.custom_field, `cf-${field.id}`)){
                    const value = data.custom_field[`cf-${field.id}`] ? JSON.stringify(data.custom_field[`cf-${field.id}`]) : null;
                    doc.value = value;
                    await models.character_custom_field.create(doc);
                }
            }
        }

        const sources = (await models.skill_source.find({campaign_id: data.campaign_id, required:true})).sort(skillHelper.sourceSorter);

        for (const source of sources){
            await this.addSource(source.id, true);
        }
        return this.calculateCP();
    }

    async update(data){
        const doc = {};
        for (const field of ['name', 'user_id', 'extra_traits', 'notes', 'gm_notes', 'pronouns']){
            if (_.has(data, field)){
                doc[field] = data[field];
            }
        }

        await models.character.update(this.id, doc);
        this._data = await models.character.get(this.id);
        console.log(`Update character ${this.id}: ${data.name}`);

        if (_.has(data, 'custom_field')){
            const custom_fields = await models.custom_field.find({campaign_id:this._data.campaign_id, location:'character'});
            for (const field of custom_fields){

                interface CharacterCustomField {
                    character_id: number,
                    custom_field_id: number,
                    value?:unknown
                };

                const doc: CharacterCustomField = {
                    character_id: this.id,
                    custom_field_id: field.id
                };

                if (_.has(data.custom_field, `cf-${field.id}`)){
                    const value = data.custom_field[`cf-${field.id}`] ? JSON.stringify(data.custom_field[`cf-${field.id}`]) : null;
                    const current = await models.character_custom_field.findOne(doc);
                    if (current){
                        current.value = value;
                        await models.character_custom_field.update(current.id, current);
                    } else {
                        doc.value = value;
                        await models.character_custom_field.create(doc);

                    }
                }
            }
        }
    }

    async clone(sourceCharacterId:number, userId:number, campaignId:number){
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
        this.id = await models.character.create(sourceCharacter);
        const sources = await models.character_skill_source.find({character_id:sourceCharacterId});
        for (const source of sources){
            source.character_id = this.id;
            source.updated = new Date();
            await models.character_skill_source.create(source);
        }
        const skills = await models.character_skill.find({character_id:sourceCharacterId});
        for (const skill of skills){
            skill.character_id = this.id;
            skill.updated = new Date();
            await models.character_skill.create(skill);
        }
        console.log(`Cloned character ${this.id}: ${sourceCharacter.name} from ${sourceCharacterId}`);
    }

    async addSource(sourceId:number, skipCost?:boolean){
        interface sourceDoc {
            character_id: number,
            skill_source_id: number,
            cost?:number,
        }

        const doc: sourceDoc = {
            character_id: this.id,
            skill_source_id: sourceId,
        };

        const character_source = await models.character_skill_source.findOne(doc);
        if (character_source){ return; }

        const skill_source = await models.skill_source.get(sourceId);
        if (skill_source.campaign_id != this._data.campaign_id){
            return;
        }

        if (!(this.showAll || skill_source.display_to_pc)){
            return;
        }

        if (skill_source.type.num_free){
            const sourceCount = (_.where(await this.sources(), {type_id: skill_source.type_id})).length;
            if (sourceCount < skill_source.type.num_free){
                doc.cost = 0;
            } else {
                doc.cost = skill_source.cost;
            }
        } else {
            doc.cost = skill_source.cost;
        }

        const user = await models.user.get(this._data.campaign_id, this._data.user_id);
        const cp = await campaignHelper.cpCalculator(this._data.user_id, this._data.campaign_id);
        const campaign = await models.campaign.get(this._data.campaign_id);

        if (campaign.display_cp && user.type === 'player' && this._data.active && doc.cost > (cp.usable - this._data.cp)) {
            return;
        }

        console.log(`Adding Source ${skill_source.name} to ${this.name}: ${this.id}`);

        const characterSkillSourceId = await models.character_skill_source.create(doc);

        const skills = await models.skill.find({source_id: sourceId, required:true});
        for (const skill of skills){
            await this.addSkill(skill.id, null, true);
        }
        if (skipCost){ return characterSkillSourceId; }
        await this.calculateCP();
        return characterSkillSourceId;
    }

    async removeSource(sourceId:number, skipCost?:boolean){
        sourceId = Number(sourceId);

        const skills = _.where(await this.skills(), {source_id: sourceId});

        const removableSkills = skills.filter(skill => {
            return !skill.required;
        });

        if (removableSkills.length){
            throw new Error('Can\'t remove a source that still has skills');
        }

        const sources = await this.sources();
        for (const checkSource of sources){
            if (_.isArray(checkSource.requires) && _.indexOf(checkSource.requires, sourceId) !== -1){
                throw new Error('Can\'t remove a source that is required by other sources');
            }
        }

        const source = await this.source(sourceId);

        console.log(`Removing Source ${sourceId} from ${this.name}: ${this.id}`);
        await models.character_skill_source.delete({character_id:this.id, skill_source_id: sourceId});

        await async.each(skills, async(skill) => {
            console.log(`Removing Skill ${skill.name}: ${skill.id} from ${this.name}: ${this.id} (${skill.character_skill_id})`);
            return models.character_skill.delete(skill.character_skill_id);
        });

        if (source.type.num_free && !source.character_cost){
            // we got this one for free, so move that to another source
            const sources = await this.sources();
            const updateSource = _.findWhere(sources, {type_id: source.type_id});
            if (updateSource){
                await this.updateSourceCost(updateSource.id, 0, true);
            }
        }

        if (skipCost){ return; }
        return this.calculateCP();
    }

    async addSkill(skillId:number, details, skipCost?:boolean){
        const skill = await models.skill.get(skillId);
        // If the skill isn't PC visibible, don't add it.
        if (!skill.status.purchasable){
            return;
        }
        if (skill.campaign_id !== this._data.campaign_id){
            return;
        }

        const skillCosts = skill.cost.split(/\s*,\s*/);

        // check if the character already has a skill with the same name
        const allSkills = await this.skills();

        const existing = _.where(allSkills, {name: skill.name});
        if (existing.length === skillCosts.length){
            // already have the max number of skills with this name
            return;
        }

        const sources = await this.sources();
        if (!_.findWhere(sources, {id: skill.source_id})){
            throw new Error('Do not have the source for this skill');
        }

        interface skillDoc{
            character_id: number,
            skill_id: number,
            cost?: number,
            details?:string
        };

        const doc: skillDoc = {
            character_id: this.id,
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

        const user = await models.user.get(this._data.campaign_id, this._data.user_id);
        const cp = await campaignHelper.cpCalculator(this._data.user_id, this._data.campaign_id);
        const campaign = await models.campaign.get(this._data.campaign_id);

        if (campaign.display_cp && user.type === 'player' && this._data.active && doc.cost > (cp.usable - this._data.cp)) {
            return;
        }

        console.log(`Adding Skill ${skill.name} to ${this.name}: ${this.id}`);

        const characterSkillId = await models.character_skill.create(doc);
        await cache.invalidate('character-skills-cache', this.id);
        if (skipCost){ return characterSkillId; }
        await this.calculateCP();
        return characterSkillId;
    }

    async removeSkill(characterSkillId:number, skipCost?:boolean){

        const characterSkill = await models.character_skill.get(characterSkillId);
        if (!characterSkill) {
            throw new Error('Can not find skill to remove');
        }

        const source = await models.character_skill_source.find({character_id:this.id, skill_source_id:characterSkill.source_id});

        if (source && characterSkill.skill.required){
            throw new Error('Can not remove required skill');
        }
        const allSkills = await this.skills();

        const skillIds = [];
        let found: boolean|number = false;
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
                throw new Error(`"${skill.name}" from ${skill.source.name} requires "${characterSkill.skill.name}"`);
            }
        }
        const doc = {
            character_id: this.id,
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
        console.log(`Removing Skill ${characterSkill.skill.name}: ${removedSkill.id} from ${this.name}: ${this.id}`);
        await models.character_skill.delete(removedSkill.id);
        await cache.invalidate('character-skills-cache', this.id);

        if (skipCost){ return removedSkill;}
        await this.calculateCP();
        return removedSkill;
    }

    async updateSkillDetails(characterSkillId, details){
        const characterSkill = await models.character_skill.get(characterSkillId);
        if (!characterSkill){
            return;
        }
        characterSkill.details = details;
        characterSkill.updated = new Date();
        await models.character_skill.update(characterSkillId, characterSkill);
        this._data = await models.character.get(this.id);
        this._data.updated = new Date();
        await models.character.update(this.id, this._data);
        return cache.invalidate('character-skills-cache', this.id);
    }

    async data(){
        this._data = await models.character.get(this.id);
        const doc = JSON.parse(JSON.stringify(this._data));
        doc.sources = await this.sources();
        doc.skills = await this.skills();
        doc.user = await models.user.get(this._data.campaign_id, this._data.user_id);

        doc.provides = await gatherProvides(doc.sources, false, null);
        doc.provides = await gatherProvides(doc.skills, true, doc.provides);
        doc.provides.attributes = await this.prepAttributes(doc.provides.attributes);
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

        doc.provides.attributes = await campaignHelper.attributeSorter(doc.provides.attributes, this._data.campaign_id);
        doc.provides.internalAttributes = await campaignHelper.attributeSorter(doc.provides.internalAttributes, this._data.campaign_id);

        if (this._data.extra_traits){
            if (!_.has(doc.provides.traits, 'Character')){
                doc.provides.traits.Character = [];
            }
            const traits = this._data.extra_traits.split(/\s*,\s*/);
            for (const trait of traits){
                doc.provides.traits.Character.push(trait);
            }
        }
        doc.custom_field = await models.character_custom_field.find({character_id:this.id});
        doc.custom_field =  _.sortBy(doc.custom_field, (field) => { return field.custom_field.display_order;});

        return doc;
    }

    async skills(noCache?){
        let skills = await cache.check('character-skills-cache', this.id);
        if (!noCache && skills){
            return skills;
        }

        skills = await models.character_skill.find({character_id:this.id});
        const allSkills = JSON.parse(JSON.stringify(skills));
        skills = skills.map(skill => {
            const doc = skill.skill;
            delete doc.notes;
            doc.details = skill.details;
            doc.character_cost = skill.cost;
            doc.character_skill_id = skill.id;
            doc.character_updated = skill.updated;
            doc.removable = true;
            if (doc.required){
                doc.removable = false;
                doc.no_remove_reason = 'Required';
            } else {
                for (const checkSkill of allSkills){
                    if (_.isArray(checkSkill.skill.requires) && _.indexOf(checkSkill.skill.requires, skill.skill.id) !== -1){
                        doc.removable = false;
                        doc.no_remove_reason = `Prereq for "${checkSkill.skill.name}"`;
                    }
                }
            }

            return doc;
        }).sort(skillHelper.sorter);
        await cache.store('character-skills-cache', this.id, skills, 3);
        return skills;
    }

    async skill(characterSkillId:number){
        const skill = await models.character_skill.get(characterSkillId);
        const doc = skill.skill;
        delete doc.notes;
        doc.details = skill.details;
        doc.character_cost = skill.cost;
        doc.character_skill_id = skill.id;
        doc.character_updated = skill.updated;
        doc.removable = true;

        if (doc.required){
            doc.removable = false;
            doc.no_remove_reason = 'Required';
        } else {
            const allSkills = await this.skills();
            for (const checkSkill of allSkills){
                if (_.isArray(checkSkill.requires) && _.indexOf(checkSkill.requires, skill.id) !== -1){
                    doc.removable = false;
                    doc.no_remove_reason = `Prereq for "${checkSkill.name}"`;
                }
            }
        }
        return doc;
    }

    async skillProvides(characterSkillId: number){
        const skill = await this.skill(characterSkillId);
        return gatherProvides([skill], true, null, true);
    }

    async sources(skipSkills?:boolean){
        const sources = (await models.character_skill_source.find({character_id:this.id})).sort(skillHelper.sourceSorter);

        const allSources = JSON.parse(JSON.stringify(sources));
        const filledSouces = await async.mapLimit(sources, 3, async (source) => {
            const doc = source.skill_source;
            delete doc.notes;
            doc.character_cost = source.cost;
            doc.character_updated = source.updated;
            if (skipSkills){
                return doc;
            }
            const skills = (await this.skills()).filter(skill => {
                return skill.source_id === source.skill_source_id;
            });

            doc.character_skills = skills;

            doc.removable = true;

            if (source.skill_source.required){
                doc.removable = false;
                doc.no_remove_reason = 'Required';

            } else {

                doc.removable = !(skills.filter(skill => {
                    return skill.removable;
                })).length;
                if (!doc.removable){
                    doc.no_remove_reason = 'Has Purchased Skills';
                } else {

                    for (const checkSource of allSources){
                        if (_.isArray(checkSource.skill_source.requires) && _.indexOf(checkSource.skill_source.requires, source.skill_source.id) !== -1){
                            doc.removable = false;
                            doc.no_remove_reason = `Prereq for "${checkSource.skill_source.name}"`;

                        }
                    }
                }
            }

            return doc;
        });

        return filledSouces.sort(skillHelper.sourceSorter);
    }

    async source(sourceId){
        const source = await models.character_skill_source.findOne({character_id: this.id, skill_source_id:sourceId});
        if (!source) { return; }
        const doc = source.skill_source;
        delete doc.notes;
        doc.character_cost = source.cost;
        doc.character_updated = source.updated;
        const skills = (await this.skills()).filter(skill => {
            return skill.source_id === source.skill_source_id;
        });
        doc.character_skills = skills;

        if (source.skill_source.required){
            doc.removable = false;
            doc.no_remove_reason = 'Required';
        } else {
            doc.removable = !(skills.filter(skill => {
                return _.indexOf(skill.tags, 'required') === -1;
            })).length;
            if (!doc.removable){
                doc.no_remove_reason = 'Has Purchased Skills';
            } else {
                const allSources = await this.sources();
                for (const checkSource of allSources){
                    if (_.isArray(checkSource.requires) && _.indexOf(checkSource.requires, source.skill_source.id) !== -1){
                        doc.removable = false;
                        doc.no_remove_reason = `Prereq for "${checkSource.skill_source.name}"`;
                    }
                }
            }
        }

        return doc;
    }

    async cp(){
        this._data = await models.character.get(this.id);
        return this._data.cp;
    }

    async calculateCP(){
        let cp = 0;
        const sources = await this.sources();
        for (const source of sources){
            cp += Number(source.character_cost);
        }
        const skills = await this.skills();
        for (const skill of skills){
            cp += Number(skill.character_cost);
        }
        this._data = await models.character.get(this.id);
        this._data.cp = cp;
        this._data.updated = new Date();
        return models.character.update(this.id, this._data);
    }

    async recalculate(allSkills?){
        // Add any missing required sources
        const requiredSources = (await models.skill_source.find({campaign_id: this._data.campaign_id, required:true})).sort(skillHelper.sourceSorter);
        for (const source of requiredSources){
            await this.addSource(source.id, true);
        }

        // recalculate CP costs and required skills of Sources
        const charSources = _.groupBy(await this.sources(true), 'type_id');

        for (const type in charSources){
            const sources = charSources[type];
            if (sources[0].type.num_free){
                const num_free = sources[0].type.num_free;
                for (let i = 0; i < Math.min(num_free, sources.length); i++){
                    const source = sources.pop();
                    if (Number(source.character_cost) !== 0){
                        await this.updateSourceCost(source.id, 0);
                    }
                    // Add required skills from source
                    const skills = await findRequiredSkills(source.id);
                    for (const skill of skills){
                        await this.addSkill(skill.id, null, true);
                    }
                }
            }
            for (const source of sources){
                if (Number(source.cost) !== Number(source.character_cost)){
                    await this.updateSourceCost(source.id, source.cost, true);
                }
                // Add required skills from source
                const skills = await findRequiredSkills(source.id);
                for (const skill of skills){

                    await this.addSkill(skill.id, null, true);
                }
            }
        }

        const allCharSkills:CharacterSkillModel[] = await this.skills();

        // check for sources that are not purchasable and remove them
        for (const skill of allCharSkills){
            if (! skill.status.purchasable ){
                await this.removeSkill(skill.character_skill_id, true);
            }
        }

        // Recalculate CP cost of Skills
        const charSkills = _.groupBy(await this.skills(), 'id');
        for (const id in charSkills){
            const skills = charSkills[id];

            for (let i = 0; i < skills.length; i++){
                const skill = skills[i];
                const skillCosts = skill.cost.split(/\s*,\s*/);
                const cost = skillCosts[i] || 0;
                if (Number(cost) !== Number(skill.character_cost)){
                    await this.updateSkillCost(skill.character_skill_id, cost, true);
                }
            }
        }

        return this.calculateCP();

        async function findRequiredSkills(sourceId){
            if (allSkills){
                return _.where(allSkills, {source_id: sourceId, required:true});
            }
            return models.skill.find({source_id: sourceId, required:true});
        }
    }

    async updateSourceCost(sourceId, cost, skipCost?:boolean){
        const conditions = {
            character_id: this.id,
            skill_source_id: sourceId
        };
        const data = { cost: cost };
        console.log(`Setting Source ${sourceId} to ${cost} on ${this.name}: ${this.id}`);
        await models.character_skill_source.update(conditions, data);
        if (skipCost){ return; }
        return this.calculateCP();
    }

    async updateSkillCost(skillId:number, cost:number|string, skipCost?:boolean){
        const characterSkill = await models.character_skill.get(skillId);
        if (!characterSkill) { return; }
        characterSkill.cost = cost;
        console.log(`Setting Skill ${skillId} to ${cost} on ${this.name}: ${this.id}`);

        await models.character_skill.update(skillId, characterSkill);
        await cache.invalidate('character-skills-cache', this.id);
        if (skipCost){ return; }
        return this.calculateCP();
    }

    async pdf(options: CharacterSheetOptions){
        return characterRenderer([await this.data()], options);
    }

    async possibleSkills(all?:boolean){
        const sources = await this.sources();
        const localSkills = await this.skills();

        let skills = [];
        const user = await models.user.get(this._data.campaign_id, this._data.user_id);
        const cp = await campaignHelper.cpCalculator(this._data.user_id, this._data.campaign_id);
        const campaign = await models.campaign.get(this._data.campaign_id);

        await async.each(sources, async (source) => {
            const sourceSkills = await models.skill.find({source_id: source.id});
            checkSkills: for (const skill of sourceSkills){
                // Show all skills, if showAll, otherwise show purchasable and visible skills (or purchasable + all)
                if (!(this.showAll || (skill.status.purchasable && (all || skill.status.display_to_pc)))){
                    continue checkSkills;
                }

                const matches = _.where(localSkills,  {name: skill.name});
                const skill_costs = skill.cost?skill.cost.split(/\s*,\s*/):[0];
                if (matches.length >= skill_costs.length){
                    continue checkSkills;
                }
                skill.next_cost = skill_costs[matches.length];

                if (_.isArray(skill.conflicts)){
                    for (const conflict of skill.conflicts){
                        if (_.findWhere(localSkills, {id: Number(conflict)} )){
                            continue checkSkills;
                        }
                    }
                }

                if (_.isArray(skill.requires)){
                    let found = 0;
                    for (const item of skill.requires){
                        if (_.findWhere(localSkills, {id: Number(item)} )){
                            found++;
                        }
                    }
                    if (found < skill.require_num){
                        continue checkSkills;
                    }
                }


                const existing = _.findWhere(skills, {name: skill.name});
                if (existing){
                    if (existing.cost < skill.cost){
                        continue checkSkills;
                    }
                    skills = _.without(skills, existing);
                }

                if (campaign.display_cp && user.type === 'player' && this._data.active && Number(skill.next_cost) > (cp.usable - this._data.cp)) {
                    continue checkSkills;
                }

                skill.provides_data = await gatherProvides([skill], true, null, true);

                skills.push(skill);
            }
            return;
        });

        return skills.sort(skillHelper.sorter);

    }
    async possibleSources(campaignId:number, all?:boolean){
        const sources = await models.skill_source.find({campaign_id:campaignId});
        const localSources = await this.sources();

        const user = await models.user.get(this._data.campaign_id, this._data.user_id);
        const cp = await campaignHelper.cpCalculator(this._data.user_id, this._data.campaign_id);
        const campaign = await models.campaign.get(this._data.campaign_id);

        return sources.filter (source => {
            if (_.findWhere(localSources, {id: source.id} )){
                return false;
            }
            if (!(this.showAll || all || source.display_to_pc)){
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

            if (campaign.display_cp && user.type === 'player' && this._data.active && source.cost > (cp.usable - this._data.cp)) {
                return false;
            }
            return true;
        });
    }

    async activate(){
        this._data = await models.character.get(this.id);

        const user = await models.user.get(this._data.campaign_id, this._data.user_id);
        const campaign = await models.campaign.get(this._data.campaign_id);
        const cp = await campaignHelper.cpCalculator(this._data.user_id, this._data.campaign_id);

        if (this._data.active){
            return;
        }

        if (user.type === 'player' && this._data.cp > cp.usable && campaign.display_cp) {
            return;
        }

        if (user.type === 'player'){
            const characters = await models.character.find({user_id: user.id, campaign_id:this._data.campaign_id});
            await async.each(characters, async (character:CharacterData) => {
                if (character.active){
                    character.active = false;
                    character.updated = new Date();
                    return models.character.update(character.id, character);
                }
            });
        }
        this._data = await models.character.get(this.id);
        this._data.active = true;
        this._data.updated = new Date();
        return models.character.update(this.id, this._data);
    }
    get name(){
        return this._data.name;
    }
    get active(){
        return this._data.active;
    }

    async _updateTimestamp(){
        this._data = await models.character.get(this.id);
        this._data.updated = new Date();
        return models.character.update(this.id, this._data);
    }

    async audits(playerOnly?:boolean){
        const audits = await models.audit.find({object_type: 'character', object_id: this.id});
        const custom_fields = await models.custom_field.find({campaign_id:this._data.campaign_id, location:'character'});
        await async.each(audits, async (audit:Audit) => {
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
                audit.data.details = formatDetails((audit.data.details as Record<string, unknown>).old, (audit.data.details as Record<string, unknown>).new);
            }
            if (audit.action === 'update'){
                if (playerOnly){
                    audit.data.old = filterPlayerData(audit.data.old, custom_fields);
                    audit.data.new = filterPlayerData(audit.data.new, custom_fields);
                }
                audit.changes = await formatUpdate(audit.data.old, audit.data.new, custom_fields);
            }
        });
        return audits;
    }

    async prepAttributes(characterAttributes){
        const attributeList = await models.attribute.find({campaign_id:this._data.campaign_id});
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

interface Audit {
    action: string,
    created: Date,
    createdFormated?: {
        day: string,
        hour: string
    },
    changes: object[],
    data: {
        old: {
            [key:string]: object
        },
        new: {
            [key:string]: object
        },
        details: Record<string, unknown>|Record<string, unknown>[]
        [key:string]: object
    }
}

export default Character;

async function gatherProvides (items, isSkills, provides, singleSkill?:boolean){
    if (!provides){
        provides = {
            attributes: {},
            styles: {},
            traits: {},
            skills: [],
            rules: [],
            languages: [],
            tagskills: [],
            diagnose: [],
            crafting: {},
            features: false,
            skill:false
        };
    }


    for (const item of items){

        if (_.isArray(item.provides) && item.provides.length){
            for (const provider of item.provides){
                provides.features = true;
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
                        if (provider.value){
                            const traits = provider.value.split(/\s*,\s*/);
                            for(const trait of traits){
                                if (_.indexOf(provides.diagnose, trait) === -1){
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

                    case 'rule': {
                        provides.rules.push(item);
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
                                    provides.skill = true;
                                }
                            } else {
                                provides.skills.push(fakeSkill('Unset User-Chosen Skill', item.name, isSkills?item.source.name:item.name));
                                provides.skill = true;
                            }
                        } else if (isSkills){
                            if (!singleSkill){
                                provides.skills.push(item);
                            }
                            provides.skill = true;
                        }
                        break;
                    }

                }
            }
        } else {
            if (isSkills){
                if (!singleSkill) {
                    provides.skills.push(item);
                }
                provides.skill = true;
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
        },
        fake:true
    };
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

async function formatUpdate(oldCharacter, newCharacter, custom_fields){
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

    for (const field of custom_fields){
        let oldValue = null;
        let newValue = null;
        if (_.has(newCharacter, 'custom_field') && _.has(newCharacter.custom_field, `cf-${field.id}`)){
            newValue = newCharacter.custom_field[`cf-${field.id}`];
        }
        if (_.has(oldCharacter, 'custom_field')){
            const oldField = _.findWhere(oldCharacter.custom_field,{custom_field_id: field.id});
            if (oldField){
                oldValue = oldField.value;
            }
        }
        if (oldValue !== newValue){
            changes.push({
                field: field.name,
                type: 'field',
                old: field.type==='boolean'?oldValue?'true':'false':oldValue,
                new: field.type==='boolean'?newValue?'true':'false':newValue,
            });
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
        if (!oldCharacter || newCharacter.active==='on' !== oldCharacter.active){
            changes.push({
                field: 'active',
                type: 'field',
                old: oldCharacter?oldCharacter.active?'Yes':'No':null,
                new: newCharacter.active==='on'?'Yes':'No'
            });

        }
    } else {
        if (oldCharacter && oldCharacter.active){
            if (_.has(newCharacter, 'active')){
                changes.push({
                    field: 'active',
                    type: 'field',
                    old: oldCharacter?oldCharacter.active?'Yes':'No':null,
                    new: newCharacter.active==='on'?'Yes':'No'
                });
            }
        }
    }
    return changes;
}

function filterPlayerData(data, custom_fields){
    if(!_.has(data, 'custom_field')){
        return data;
    }
    const output: CharacterData = {};
    for (const field in data){
        if (field == 'custom_field'){
            if (_.isArray(data.custom_field)){
                output.custom_field = [];
                for (const custom_field_data of data.custom_field){
                    const custom_field = _.findWhere(custom_fields, {id:custom_field_data.custom_field_id});
                    if (custom_field.display_to_pc){
                        (output.custom_field as object[]).push(custom_field_data);
                    }
                }
            } else {
                output.custom_field = {};
                for (const custom_field_id in data.custom_field){
                    const custom_field = _.findWhere(custom_fields, {id: Number(custom_field_id.replace(/^cf-/, ''))});
                    if (custom_field.display_to_pc){
                        output.custom_field[custom_field_id] = data.custom_field[custom_field_id];
                    }
                }
            }

        } else {
            output[field] = data[field];
        }
    }
    return output;
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
