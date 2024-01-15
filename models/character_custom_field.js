'use strict';

const Model = require('../lib/Model');

const models = {
    custom_field: require('./custom_field')
};

const tableFields = [
    'id',
    'character_id',
    'custom_field_id',
    'value',
    'updated'
];

const CharacterCustomField = new Model('character_custom_fields', tableFields, {
    order: ['character_id', 'custom_field_id', 'updated'],
    postSelect: fill
});

module.exports = CharacterCustomField;

async function fill(record){
    record.custom_field = await models.custom_field.get(record.custom_field_id);
    return record;
}


