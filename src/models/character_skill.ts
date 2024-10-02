'use strict';

import Model from  '../lib/Model';

import skillModel from './skill';

const models = {
    skill: skillModel
};

const tableFields = [
    'id',
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

async function fill(record){
    record.skill = await models.skill.get(record.skill_id);
    return record;
}

export = CharacterSkill;

