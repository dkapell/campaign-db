'use strict';

import validator from 'validator';
import Model from  '../lib/Model';

const tableFields = [
    'id',
    'campaign_id',
    'name',
    'type',
    'is_default',
    'definition',
    'created'
];

const Survey = new Model('surveys', tableFields, {
    order: ['type', 'is_default desc'],
    validator: validate,
    skipAuditFields: ['created']
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}


export = Survey;
