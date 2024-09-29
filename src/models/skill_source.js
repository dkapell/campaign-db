'use strict';
const validator = require('validator');
const Model = require('../lib/Model');

const models = {
    source_type: require('./skill_source_type')
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
    'conflicts',
    'required',
    'display_to_pc'
];

const SkillSource = new Model('skill_sources', tableFields, {
    order: ['type_id', 'name'],
    validator: validate,
    postSelect: fill
});

module.exports = SkillSource;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
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
