'use strict';

const validator = require('validator');
const Model = require('../lib/Model');


const tableFields = [
    'id',
    'campaign_id',
    'name',
    'description',
    'type',
    'location',
    'display_order',
    'display_to_pc',
    'editable_by_pc',
    'required',
    'configuration'
];

const CustomField = new Model('custom_fields', tableFields, {
    order: ['display_order'],
    validator: validate
});

module.exports = CustomField;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}



