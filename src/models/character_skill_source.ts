'use strict';

import Model from  '../lib/Model';

import skill_sourceModel from './skill_source';

const models = {
    skill_source: skill_sourceModel
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

async function fill(record){
    record.skill_source = await models.skill_source.get(record.skill_source_id);
    return record;
}

export = CharacterSkillSource;
