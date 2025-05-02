'use strict';
import validator from 'validator';
import Model from  '../lib/Model';

import skill_source_typeModel from './skill_source_type';
const models = {
    source_type: skill_source_typeModel
};


const tableFields = [
    'id',
    'campaign_id',
    'name',
    'description',
    'notes',
    'type_id',
    'cost',
    'provides',
    'requires',
    'require_num',
    'max_skills',
    'conflicts',
    'required',
    'display_to_pc'
];

const SkillSource = new Model('skill_sources', tableFields, {
    order: ['type_id', 'name'],
    validator: validate,
    postSelect: fill
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

async function fill(record){
    if (record.type_id){
        record.type = await models.source_type.get(record.type_id);
    } else {
        record.type = null;
    }
    return record;
}

export = SkillSource;

