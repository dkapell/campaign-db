'use strict';

const Model = require('../lib/Model');

const models = {
    skill: require('./skill')
};

const tableFields = [
    'id',
    'campaign_id',
    'character_id',
    'skill_id',
    'details',
    'updated',
    'cost'
];

const CharacterSkill = new Model('character_skills', tableFields, {
    order: ['character_id', 'skill_id', 'updated'],
    postSelect: fill
});

module.exports = CharacterSkill;

async function fill(record){
    record.skill = await models.skill.get(record.skill_id);
    return record;
}


