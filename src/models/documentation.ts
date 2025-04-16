'use strict';
import validator from 'validator';
import _ from 'underscore';
import Model from  '../lib/Model';


const tableFields = [
    'id',
    'campaign_id',
    'name',
    'description',
    'on_checkin',
    'valid_from',
    'staff_only',
    'display_order'
];

const Documentation = new Model('documentations', tableFields, {
    validator: validate,
    order: ['display_order'],
});

export = Documentation;

function validate(data){
    if (_.has(data, 'name') && ! validator.isLength(data.name, {min:2, max:80})){
        return false;
    }
    return true;
}


