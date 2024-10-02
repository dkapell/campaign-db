'use strict';

import Model from  '../lib/Model';

import custom_fieldModel from './custom_field';
const models = {
    custom_field: custom_fieldModel
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

async function fill(record){
    record.custom_field = await models.custom_field.get(record.custom_field_id);
    return record;
}

export = CharacterCustomField;

