'use strict';
import validator from 'validator';
import Model from  '../lib/Model';


const tableFields = [
    'id',
    'campaign_id',
    'name',
    'description',
    'initial',
    'display_order',
    'calculated',
    'toughness',
    'calculation'
];

const Attribute = new Model('attributes', tableFields, {
    order: ['display_order'],
    validator: validate
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

export = Attribute;
