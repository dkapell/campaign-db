'use strict';

const Model = require('../lib/Model');

const models = {
    skill_source: require('./skill_source')
};

const tableFields = [
    'character_id',
    'skill_source_id',
    'updated',
    'cost',
];

const CharacterSkillSource = new Model('character_skill_sources', tableFields, {
    order: ['character_id', 'skill_source_id'],
    keyFields: ['character_id', 'skill_source_id'],
    postSelect: fill
});

module.exports = CharacterSkillSource;

async function fill(record){
    record.skill_source = await models.skill_source.get(record.skill_source_id);
    return record;
}


