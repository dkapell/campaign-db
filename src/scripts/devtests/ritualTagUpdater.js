'use strict';

const async = require('async');
const _ = require('underscore');
const config = require('config');
const pluralize = require('pluralize');
const models = require('../../lib/models');
const database = require('../../lib/database');

const targetCampaign = 3;

const tagLookup = {
    'Archaeology': 'archaeology',
    'Attribute': 'attribute',
    'BSA': 'bsa',
    'Centering': null,
    'Crafting': 'crafting',
    'Defense': 'defense',
    'Healing': 'support',
    'Info': 'information',
    'Interlude/BSA': 'bsa',
    'Melee': 'offense',
    'Method': 'method',
    'Other': null,
    'Ranged': 'offense',
    'Ritual Trait': null,
    'Scene': null,
    'Stance': null,
    'Support': 'support',
    'Weapon Style': 'weapon style'
};

(async function main() {
    const skills = await models.skill.find({campaign_id:targetCampaign});
    const skill_tags = await models.skill_tag.find({campaign_id:targetCampaign});
    const skill_types = await models.skill_type.find({campaign_id:targetCampaign});
    for (const skill of skills){
        if (!skill.type_id){
            continue;
        }
        skill.type = await models.skill_type.get(skill.type_id);

        const typeTagName = tagLookup[skill.type.name];
        if (!typeTagName) {
            console.log('no tag for ' + skill.type.name);
            continue;
        }
        const typeTag = _.findWhere(skill_tags, {'name': typeTagName});
        if (!typeTag){
            throw new Error ('Cound not find ' + typeTagName);
        }

        console.log(`${skill.type.name} -> ${typeTag.name}`);

        const tags = _.pluck(skill.tags, 'id');
        if (_.indexOf(tags, typeTag.id) !== -1){
            continue;
        }
        tags.push(typeTag.id);

        const doc = {
            name: skill.name,
            tags: tags
        };
        console.log(doc);

        await models.skill.update(skill.id, doc);
    }
    console.log('done');
    process.exit(0);
})().catch((error) => {
    console.trace(error);
    process.exit(1);
});


