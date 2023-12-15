'use strict';
const _ = require('underscore');
const async = require('async');
const models = require('../lib/models');

(async function main() {
    const skills = await models.skill.find();
    await async.eachLimit(skills, 10, fixSkill);
    console.log('done');
    process.exit(0);
})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});

const tags = {};

async function fixSkill(skill){
    skill.provides = skill.provides?JSON.stringify(skill.provides):[];
    skill.conflicts = skill.conflicts && _.isArray(skill.conflicts)?JSON.stringify(skill.conflicts.map(e => {return Number(e);})):[];
    skill.requires = skill.requires&& _.isArray(skill.requires)?JSON.stringify(skill.requires.map(e => {return Number(e);})):[];

    const current = JSON.parse(JSON.stringify(skill));

    //    const audits = (await models.audit.find({object_type: 'skill', object_id: skill.id}, {order: ['created desc'], limit: 1}));

    let modified = false;
    const deliveryRegex = /^\s*\((melee|missile|packet|touch-cast|voice|gesture|gaze|name|touch cast)\)\s*\/?\s*/;
    const activityRegex = /^\s*\(activity\)\s*(\d+)\s*(s|sec|m|min)\s*\/?\s*/;
    //const restRegex = /^\s*\(rest\)\s*(\d+)\s*(s|sec|m|min)\s*\/?\s*/;
    if (skill.summary.match(deliveryRegex)){
        //console.log(audits[0].data.old.summary);
        /*const parts = audits[0].data.old.summary.match(deliveryRegex);
        const delivery = parts[1];

        const tag = await getTag(delivery);
        if (!tag){
            console.log(`NO TAG FOUND FOR ${delivery} on ${skill.name}`);
            return;
        }
        if (_.findWhere(skill.tags, {id: tag.id})){
            return;
        }
        console.log(`Did not find ${delivery} for ${skill.name}`);

        //skill.summary = skill.summary.replace(deliveryRegex, '');
        modified = true;
        */
        /*
    } else if (skill.summary.match(activityRegex)){
        skill.summary = skill.summary.replace(activityRegex, function(match, time, units){
            let unitstr = null;
            if (units === 's' || units === 'sec'){
                unitstr = 's';
            }
            if (units === 'm' || units === 'min'){
                unitstr = 'm';
            }
            return `${time}${unitstr} Activity - `;
        });
        modified = true;
    } else if (skill.summary.match(restRegex)){
        skill.summary = skill.summary.replace(restRegex, function(match, time, units){
            let unitstr = null;
            if (units === 's' || units === 'sec'){
                unitstr = 's';
            }
            if (units === 'm' || units === 'min'){
                unitstr = 'm';
            }
            return `${time}${unitstr} Rest - `;
        });
        modified = true;
        */
    } else if (skill.summary.match(/^\s*\(/)){
        console.log (`Would not change ${skill.name} from "${skill.summary}"`);
    }
    if (skill.summary.match(/ Stat /)){
        skill.summary = skill.summary.replace(/ Stat /, ' Attribute ');
        modified = true;
    }
    if (skill.summary.match(/ Stats /)){
        skill.summary = skill.summary.replace(/ Stats /, ' Attribute ');
        modified = true;
    }
    if (skill.description.match(/ stat /i)){
        skill.description = skill.description.replace(/ stat /i, ' Attribute ');
        modified = true;
    }
    if (skill.description.match(/ stats /i)){
        skill.description = skill.description.replace(/ stats /i, ' Attribute ');
        modified = true;
    }
    if (skill.description.match(/You may repair your own armor with 1 minute of Focus/)){
        skill.description = skill.description.replace(/You may repair your own armor with 1 minute of Focus/, 'You may spend one minute of Focus to refit your own armor');
        modified = true;
    }

    if (modified){
        console.log (`Changing ${skill.name} from "${current.description}" to "${skill.description}"`);
        //console.log(JSON.stringify(skill, null, 2));
        await models.skill.update(skill.id, skill);
        await audit('skill', skill.id, 'update', {old: current, new:skill});


    } else {
        //if (!skill.updated){
        //const audits = (await models.audit.find({object_type: 'skill', object_id: skill.id}, {order: ['created desc'], limit: 1}))
        //skill.updated = audits[0].created;
        //console.log (`Changing ${skill.name} updated to ${skill.updated}`);
        //return models.skill.update(skill.id, skill);
        //}
    }
    return;
}

async function getTag(name){
    if (_.has(tags, name)){
        return tags[name];
    }
    const tag = await models.skill_tag.findOne({name:name});
    tags[name] = tag;
    return tag;
}

async function audit(objectType, objectId, action, data){
    return models.audit.create({
        user_id: 1,
        object_type: objectType,
        object_id: objectId,
        action: action,
        data: data
    });
}
