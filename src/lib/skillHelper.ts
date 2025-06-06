'use strict';
import {diffChars} from 'diff';
import _ from 'underscore';
import async from 'async';
import models from './models';
import removeMd from 'remove-markdown';
import stringify from 'csv-stringify-as-promised';
import { marked } from 'marked';

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

function sorter(a, b){
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

    if (a.required && !b.required){
        return -1;
    } else if (!a.required && b.required){
        return 1;
    }
    if (a.usage.display_order !== b.usage.display_order){
        return a.usage.display_order - b.usage.display_order;
    }
    return a.name.localeCompare(b.name);
};

function sourceSorter(a, b){
    if (!a.type) { return -1;}
    if (!b.type) { return -1;}
    if (a.type.display_order !== b.type.display_order){
        return a.type.display_order - b.type.display_order;
    }
    return a.name.localeCompare(b.name);
};

function compareArrays(a1, a2) {
    const s1 = new Set(a1);
    const s2 = new Set(a2);

    if (s1.size !== s2.size) {
        return false;
    }

    for (const item of s1) {
        if (!s2.has(item)) {
            return false;
        }
    }

    return true;
}


async function diff(oldSkill, newSkill){
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

    oldSkill.users ||= [];
    newSkill.users ||= [];
    if (typeof oldSkill.users === 'string'){
        oldSkill.users = [oldSkill.users]
    }
    if (typeof newSkill.users === 'string'){
        newSkill.users = [newSkill.users]
    }
    oldSkill.users = oldSkill.users.map(item => {return Number(item);});
    newSkill.users = newSkill.users.map(item => {return Number(item);});

    if (!compareArrays(oldSkill.users, newSkill.users)){

        const oldUserIds = _.difference(oldSkill.users, newSkill.users);
        const newUserIds = _.difference(newSkill.users, oldSkill.users);

        const oldUsers = await async.map(oldUserIds, async (userId)=> {
                const user = await models.user.get(oldSkill.campaign_id, userId);
                if (user){
                    return user.name;
                }
                return '';
            });

        const newUsers = await async.map(newUserIds, async (userId)=> {
            const user = await models.user.get(oldSkill.campaign_id, userId);
            if (user){
                return user.name;
            }
            return userId;
        });

        const output = [];
        if (oldUsers.length){
            output.push(`removed: ${oldUsers.sort().join(', ')}`);
        }
        if (newUsers.length){
            output.push(`added: ${newUsers.sort().join(', ')}`);
        }
        changes.push({
            field: 'Access',
            type: 'plaintext',
            text: output.join(', ')

        });
    }
    if (Number(oldSkill.source_id) !== Number(newSkill.source_id)){
        let newSource = 'unset';
        if (newSkill.source_id){
            const source = await models.skill_source.get(newSkill.source_id);
            if (source){
                newSource = source.name;
            } else {
                newSource = 'deleted';
            }
        }
        changes.push({
            field: 'Source',
            type: 'field',
            old: oldSkill.source_id?oldSkill.source.name:'unset',
            new: newSource
        });
    }
    if (Number(oldSkill.usage_id) !== Number(newSkill.usage_id)){
        let newUsage = 'unset';
        if (newSkill.usage_id){
            const usage = await models.skill_usage.get(newSkill.usage_id);
            if (usage){
                newUsage = usage.name;
            } else {
                newUsage = 'deleted';
            }
        }
        changes.push({
            field: 'Usage',
            type: 'field',
            old: oldSkill.usage_id?oldSkill.usage.name:'unset',
            new: newUsage
        });
    }
    if (Number(oldSkill.status_id) !== Number(newSkill.status_id)){
        let newStatus = 'unset';
        if (newSkill.status_id){
            const status = await models.skill_status.get(newSkill.status_id);
            if (status){
                newStatus = status.name;
            } else {
                newStatus = 'deleted';
            }
        }
        changes.push({
            field: 'Status',
            type: 'field',
            old: oldSkill.status_id?oldSkill.status.name:'unset',
            new: newStatus
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
    if (oldSkill.required !== newSkill.required){
        changes.push({
            field: 'Required',
            type: 'field',
            old: oldSkill.required?'true':'false',
            new: newSkill.required?'true':'false'
        });
    }
    for (const field of ['requires', 'conflicts']){
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
                    if (skill){
                        added.push(`${skill.name?skill.name:'unnamed skill'} (${skill.source?skill.source.name:'No Source'})`);
                    } else {
                        added.push('deleted skill');
                    }
                }
            }
        }
        if (_.isArray(oldSkill[field])){
            for (const skillId of oldSkill[field]){
                if (_.indexOf(newSkill[field], skillId) === -1){
                    const skill = await models.skill.get(skillId);
                    if (skill){
                        added.push(`${skill.name?skill.name:'unnamed skill'} (${skill.source?skill.source.name:'No Source'})`);
                    } else {
                        added.push('deleted skill');
                    }
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
    const diff = diffChars(oldText, newText);
    const output = [];
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

async function getCSV(skills, forPlayers){
    skills = skills.sort(sorter);
    const data = [];
    if (forPlayers){
        data.push(['Source', 'Name', 'Usage', 'Tag(s)', 'Cost', 'Summary']);
    } else {
        data.push(['Source', 'Name', 'Usage', 'Tag(s)',  'Cost', 'Summary', 'Status']);
    }

    for (const skill of skills){
        if (forPlayers && !skill.status.display_to_pc){
            continue;
        }
        const row = [];
        row.push(skill.source?skill.source.name:'No Source');
        row.push(skill.name?skill.name:'Unnamed Skill');
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
        let summary = '';
        if (skill.usage && skill.usage.display_uses && skill.uses){
            summary = `${skill.uses}/${skill.usage.usage_format}: `;
        }
        if (skill.summary){
            summary += removeMd(skill.summary);
        } else {
            summary += 'Unset'
        }

        row.push(summary);

        if (!forPlayers){
            row.push(skill.status?capitalize(skill.status.name):'');
        }
        data.push(row);
    }

    return stringify(data, {});
};

function fillProvides(provides, size){
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

function parseProvides(input){
    const output = [];
    for (const id in input){
        if (id === 'new'){
            continue;
        }

        const provides = input[id];
        if (provides.type === '-1'){
            continue;
        }
        output.push(provides);
    }
    return output;
};

function getProvidesTypes(type){
    if (type === 'skill'){
        return [
            {
                name: 'Attribute',
                value: 'attribute',
                helptext: ''
            },
            {
                name: 'Trait',
                value: 'trait',
                helptext: ''
            },
            {
                name: 'Weapon Style',
                value: 'style',
                helptext: ''
            },
            {
                name: 'Language',
                value: 'language',
                helptext: ''
            },
            {
                name: 'Tag Reading Skill',
                value: 'tagskill',
                helptext: ''
            },
            {
                name: 'Diagnose',
                value: 'diagnose',
                helptext: ''
            },
            {
                name: 'Skill',
                value: 'skill',
                helptext: ''
            },
            {
                name: 'Rule',
                value: 'rule',
                helptext: ''
            },
            {
                name: 'Crafting',
                value: 'crafting',
                helptext: ''
            }
        ];
    } else if (type === 'source'){
        return [
            {
                name: 'Attribute',
                value: 'attribute',
                helptext: ''
            },
            {
                name: 'Trait',
                value: 'trait',
                helptext: ''
            },
            {
                name: 'Weapon Style',
                value: 'style',
                helptext: ''
            },
            {
                name: 'Language',
                value: 'language',
                helptext: ''
            },
            {
                name: 'Tag Reading Skill',
                value: 'tagskill',
                helptext: ''
            },
            {
                name: 'Diagnose',
                value: 'diagnose',
                helptext: ''
            },
            {
                name: 'Crafting',
                value: 'crafting',
                helptext: ''
            }
        ];
    }
};

async function validate(skill){
    const fields = {
        name: 'Name',
        cost: 'Cost',
        source_id: 'Source',
        usage_id: 'Usage',
        summary: 'Summary',
        description: 'Description'
    };

    const issues = [];

    for (const field in fields){
        if (!skill[field]){
            issues.push({
                field:field,
                type:`Missing ${fields[field]}`
            });
        }
    }

    if (skill.conflicts){
        const conflicts = _.isArray(skill.conflicts)?skill.conflicts:_.isString(skill.conflicts)?JSON.parse(skill.conflicts):[];
        for (const conflict of conflicts){
            const conflictSkill = await models.skill.get(conflict);
            if (! conflictSkill){
                issues.push({
                    field:'conflict',
                    type: 'Deleted Conflict',
                    message: `Conflicts with deleted skill ${conflict}`
                });
            } else {

                const remoteConflicts = _.isArray(conflictSkill.conflicts)?conflictSkill.conflicts:_.isString(conflictSkill.conflicts)?JSON.parse(conflictSkill.conflicts):[];
                if (_.indexOf(remoteConflicts, skill.id) === -1){
                    issues.push({
                        field:'conflict',
                        type: 'Unmatched Conflict',
                        skill: conflictSkill
                    });

                }
            }
        }
    }

    if (skill.requires){
        const requires = _.isArray(skill.requires)?skill.requires:_.isString(skill.requires)?JSON.parse(skill.requires):[];
        if (requires.length && !skill.require_num){
            issues.push({
                field:'requires',
                type: 'No Required Count',
                message: 'Has Prereqs, but requires zero of them'
            });
        }
        for (const required of requires){
            const requiredSkill = await models.skill.get(required);
            if (! requiredSkill){
                issues.push({
                    field:'requires',
                    type: 'Deleted Required Skill',
                    message: `Requires deleted skill ${required}`
                });
            }
        }
    }

    const provides = _.isArray(skill.provides)?skill.provides:[];
    for (const provider of provides){
        switch (provider.type){
            case 'attribute':
                if (!provider.name){
                    issues.push({
                        field: 'provides',
                        type: 'Incorrect Configuration',
                        message: 'Missing Name for Attribute in Character Builder Configuration'
                    });
                }
                if (!provider.value){
                    issues.push({
                        field: 'provides',
                        type: 'Incorrect Configuration',
                        message: 'Missing Value for Attribute in Character Builder Configuration'
                    });
                }
                break;
            case 'trait':
                if (!provider.name){
                    issues.push({
                        field: 'provides',
                        type: 'Incorrect Configuration',
                        message: 'Missing Name for Trait in Character Builder Configuration'
                    });
                }
                if (!provider.value){
                    issues.push({
                        field: 'provides',
                        type: 'Incorrect Configuration',
                        message: 'Missing Value for Trait in Character Builder Configuration'
                    });
                }
                break;
            case 'style':
                if (!provider.value){
                    issues.push({
                        field: 'provides',
                        type: 'Incorrect Configuration',
                        message: 'Missing Value for Weapon Style in Character Builder Configuration'
                    });
                }
                break;
            case 'language':
                if (!provider.value){
                    issues.push({
                        field: 'provides',
                        type: 'Incorrect Configuration',
                        message: 'Missing Value for Language in Character Builder Configuration'
                    });
                }
                break;

            case 'tagskill':
                if (!provider.value){
                    issues.push({
                        field: 'provides',
                        type: 'Incorrect Configuration',
                        message: 'Missing Value for Tag Skill in Character Builder Configuration'
                    });
                }
                break;

            case 'diagnose':
                if (!provider.value){
                    issues.push({
                        field: 'provides',
                        type: 'Incorrect Configuration',
                        message: 'Missing Value for Diagnose in Character Builder Configuration'
                    });
                }
                break;

            case 'crafting':
                if (!provider.name){
                    issues.push({
                        field: 'provides',
                        type: 'Incorrect Configuration',
                        message: 'Missing Name for Crafting in Character Builder Configuration'
                    });
                }
                if (!provider.value){
                    issues.push({
                        field: 'provides',
                        type: 'Incorrect Configuration',
                        message: 'Missing Value for Crafting in Character Builder Configuration'
                    });
                }
                break;
        }
    }
    return issues;
};

function capitalize(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export default {
    sorter,
    sourceSorter,
    diff,
    getCSV,
    fillProvides,
    parseProvides,
    getProvidesTypes,
    validate
}
