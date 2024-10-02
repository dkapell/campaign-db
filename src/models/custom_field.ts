'use strict';

import validator from 'validator';
import Model from  '../lib/Model';

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

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}


export = CustomField;
