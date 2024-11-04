'use strict';
import validator from 'validator';
import Model from  '../lib/Model';

const tableFields = [
    'id',
    'campaign_id',
    'user_id',
    'content',
    'amount',
    'approved',
    'created'
];

const CpGrant = new Model('cp_grant', tableFields, {
    order: ['created desc'],
    validator: validate
});

function validate(data){
    if (! validator.isLength(data.content, {min:2, max:512})){
        return false;
    }
    return true;
}

export = CpGrant;

