'use strict';
const Diff = require('diff');
const _ = require('underscore');
const config = require('config');
const models = require('./models');
const removeMd = require('remove-markdown');
const stringify = require('csv-stringify-as-promised');
const {marked} = require('marked');

const renderer = {
    image(href, title, text){
        if (text.match(/^Aspect Tile/)){
            let out = '<img style="height: 1.2em" src="' + href + '" alt="' + text + '"';
            if (title) {
                out += ' title="' + title + '"';
            }
            out += '>';
            return out;
        }
        return marked.Renderer.prototype.image.call(this, href, title, text);
    }
};
marked.use({ renderer });

exports.sorter = function sorter(a, b){
    if (!a.source) {return -1; }
    if (!b.source) {return 1; }
    if (a.source.type.display_order !== b.source.type.display_order){
        return a.source.type.display_order - b.source.type.display_order;
    }
    if (a.source_id !== b.source_id){
        return a.source.name.localeCompare(b.source.name);
    }

    if (!a.usage) {return -1; }
    if (!b.usage) {return 1; }

    if (_.findWhere(a.tags, {name: 'required'}) && !_.findWhere(b.tags, {name: 'required'})){
        return -1;
    } else if (!_.findWhere(a.tags, {name: 'required'}) && _.findWhere(b.tags, {name: 'required'})){
        return 1;
    }
    if (a.usage.display_order !== b.usage.display_order){
        return a.usage.display_order - b.usage.display_order;
    }
    return a.name.localeCompare(b.name);
};

exports.sourceSorter = function sourceSorter(a, b){
    if (!a.type) { return -1;}
    if (!b.type) { return -1;}
    if (a.type.display_order !== b.type.display_order){
        return a.type.display_order - b.type.display_order;
    }
    return a.name.localeCompare(b.name);
};


exports.diff = async function differ(oldSkill, newSkill){
    const changes = [];

    if (!oldSkill){
        changes.push({
            field: 'Skill',
            type: 'status',
            status: 'Created'
        });
        return changes;
    }
    if (!newSkill){
        changes.push({
            field: 'Skill',
            type: 'status',
            status: 'Deleted'
        });
        return changes;
    }
    if (oldSkill.name !== newSkill.name){
        changes.push({
            field: 'Name',
            type: 'field',
            old: oldSkill.name,
            new: newSkill.name
        });
    }
    if (oldSkill.cost !== newSkill.cost){
        changes.push({
            field: 'Cost',
            type: 'field',
            old: oldSkill.cost,
            new: newSkill.cost
        });
    }
    if (Number(oldSkill.source_id) !== Number(newSkill.source_id)){
        changes.push({
            field: 'Source',
            type: 'field',
            old: oldSkill.source_id?oldSkill.source.name:'unset',
            new: newSkill.source_id?(await models.skill_source.get(newSkill.source_id)).name:'unset'
        });
    }
    if (Number(oldSkill.usage_id) !== Number(newSkill.usage_id)){
        changes.push({
            field: 'Usage',
            type: 'field',
            old: oldSkill.usage_id?oldSkill.usage.name:'unset',
            new: newSkill.usage_id?(await models.skill_usage.get(newSkill.usage_id)).name:'unset'
        });
    }
    if (Number(oldSkill.type_id) !== Number(newSkill.type_id)){
        changes.push({
            field: 'Type',
            type: 'field',
            old: oldSkill.type_id?oldSkill.type.name:'unset',
            new: newSkill.type_id?(await models.skill_type.get(Number(newSkill.type_id))).name:'unset'
        });
    }
    if (Number(oldSkill.status_id) !== Number(newSkill.status_id)){
        changes.push({
            field: 'Status',
            type: 'field',
            old: oldSkill.status_id?oldSkill.status.name:'unset',
            new: newSkill.status_id?(await models.skill_status.get(newSkill.status_id)).name:'unset'
        });
    }
    if (oldSkill.summary !== newSkill.summary){
        changes.push({
            field: 'Summary',
            type: 'text',
            text: htmlDiff(oldSkill.summary, newSkill.summary)
        });
    }
    if (oldSkill.description !== newSkill.description){
        changes.push({
            field: 'Description',
            type: 'longtext',
            text: htmlDiff(oldSkill.description, newSkill.description)
        });
    }
    if (oldSkill.notes !== newSkill.notes){
        changes.push({
            field: 'Notes',
            type: 'longtext',
            text: htmlDiff(oldSkill.notes, newSkill.notes)
        });
    }
    for (const field of ['requires', 'conflicts']){
        let oldSkills = [];
        let newSkills = [];
        if (oldSkill[field] && _.isString(oldSkill[field])){
            oldSkill[field] = JSON.parse(oldSkill[field]);
        }
        if (newSkill[field] && _.isString(newSkill[field])){
            newSkill[field] = JSON.parse(newSkill[field]);
        }

        const added = [];
        const removed = [];

        if (_.isArray(newSkill[field])){
            for (const skillId of newSkill[field]){
                if (_.indexOf(oldSkill[field], skillId) === -1){
                    const skill = await models.skill.get(skillId);
                    added.push(`${skill.name} (${skill.source.name})`);
                }
            }
        }
        if (_.isArray(oldSkill[field])){
            for (const skillId of oldSkill[field]){
                if (_.indexOf(newSkill[field], skillId) === -1){
                    const skill = await models.skill.get(skillId);
                    removed.push(`${skill.name} (${skill.source.name})`);
                }
            }
        }

        if (added.length){
            changes.push({
                field: `${capitalize(field)} Added`,
                type: 'tags',
                tags: added
            });
        }
        if (removed.length){
            changes.push({
                field: `${capitalize(field)} Removed`,
                type: 'tags',
                tags: removed
            });
        }



    }
    let oldProvides = [{type:null, name:null, value:null}];
    let newProvides = [{type:null, name:null, value:null}];
    if (_.has(oldSkill, 'provides') && oldSkill.provides && oldSkill.provides!== '{}'){
        if (_.isString(oldSkill.provides)){
            const parsed = JSON.parse(oldSkill.provides);
            if (parsed){
                oldProvides = parsed;
            }
        } else {
            oldProvides = oldSkill.provides;
        }
    }
    if (_.has(newSkill, 'provides') && _.isString(newSkill.provides)&& newSkill.provides!== '{}'){
        if (_.isString(newSkill.provides)){
            const parsed = JSON.parse(newSkill.provides);
            if (parsed){
                newProvides = parsed;
            }
        } else {
            newProvides = newSkill.provides;
        }
    }


    for (let i = 0 ; i < Math.max(newProvides.length, oldProvides.length); i++){
        const oldParts = [];
        const newParts = [];
        for (const field of ['type', 'name', 'value']){
            if (oldProvides[i] && oldProvides[i][field]){
                oldParts.push(oldProvides[i][field]);
            }
            if (newProvides[i] && newProvides[i][field]){
                newParts.push(newProvides[i][field]);
            }
        }

        const oldProvidesStr = oldParts.join(': ');
        const newProvidesStr = newParts.join(': ');

        if (oldProvidesStr !== newProvidesStr){
            changes.push({
                field: 'Provides',
                type: 'plaintext',
                text: [oldProvidesStr, newProvidesStr].join(' -> ')
            });

        }
    }

    const oldTags = oldSkill.tags.map( tag => {
        if (_.isString(tag)){
            return Number(tag);
        }
        if (_.has(tag, 'id')){
            return Number(tag.id);
        }
    });
    const newTags = newSkill.tags.map( tag => {
        if (_.isString(tag)){
            return Number(tag);
        }
        if (_.has(tag, 'id')){
            return Number(tag.id);
        }
        return;
    });

    const tagsAdded = [];
    const tagsRemoved = [];

    for (const tag of newTags){
        if (_.indexOf(oldTags, tag) === -1){
            const tagData = await models.skill_tag.get(tag);
            if (tagData){
                tagsAdded.push(tagData.name);
            } else {
                tagsAdded.push('[deleted tag]');
            }
        }
    }
    for (const tag of oldTags){
        if (_.indexOf(newTags, tag) === -1){
            const tagData = await models.skill_tag.get(tag);
            if (tagData){
                tagsRemoved.push(tagData.name);
            } else {
                tagsRemoved.push('[deleted tag]');
            }
        }
    }

    if (tagsAdded.length){
        changes.push({
            field: 'Tags Added',
            type: 'tags',
            tags: tagsAdded
        });
    }

    if (tagsRemoved.length){
        changes.push({
            field: 'Tags Removed',
            type: 'tags',
            tags: tagsRemoved
        });
    }

    return changes;
};

function htmlDiff(oldText, newText){
    if (!oldText){
        oldText = '';
    }
    if (!newText){
        newText = '';
    }
    const diff = Diff.diffChars(oldText, newText);
    let output = [];
    diff.forEach((part) => {
        // green for additions, red for deletions
        // grey for common parts
        const color = part.added ? 'green' : part.removed ? 'red' : 'grey';
        output.push({
            text: part.value,
            color: color
        });
    });
    return output;
}

exports.getCSV = async function(skills, forPlayers){
    skills = skills.sort(exports.sorter);
    const data = [];
    if (forPlayers){
        data.push(['Source', 'Name', 'Usage', 'Tag(s)', 'Cost', 'Summary', 'Cost']);
    } else {
        data.push(['Source', 'Name', 'Type', 'Usage', 'Tag(s)',  'Cost', 'Summary', 'Status']);
    }

    for (const skill of skills){
        if (forPlayers && !(skill.status.display_to_pc || config.get('skill.showAll'))){
            continue;
        }
        const row = [];
        row.push(skill.source?skill.source.name:'No Source');
        row.push(skill.name?skill.name:'Unnamed Skill');
        if (!forPlayers){
            row.push(skill.type?capitalize(skill.type.name):'');
        }
        row.push(skill.usage?capitalize(skill.usage.name):'');
        if (skill.tags){
            const tags = skill.tags.filter( tag => {
                if (tag.display_to_pc || !forPlayers){
                    return true;
                }
                return false;
            });
            row.push(_.pluck(tags, 'name').join(', '));
        } else {
            row.push('');
        }
        row.push(skill.cost?skill.cost:'');
        row.push(skill.summary?removeMd(skill.summary):'');

        if (!forPlayers){
            row.push(skill.status?capitalize(skill.status.name):'');
        }
        data.push(row);
    }

    return stringify(data);
};

exports.fillProvides = function fillProvides(provides, size){
    let needed = size;
    if (!_.isArray(provides)){
        provides = [];
    } else {
        needed = size - provides.length;
    }
    for (let i = 0; i < needed; i++){
        provides.push({
            type: null,
            name: null,
            value: null
        });
    }
    return provides;
};

function capitalize(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}
