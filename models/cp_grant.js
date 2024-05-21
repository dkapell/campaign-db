'use strict';
const validator = require('validator');
const Model = require('../lib/Model');


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
    order: ['created'],
    validator: validate
});

module.exports = CpGrant;

function validate(data){
    if (! validator.isLength(data.content, 2, 512)){
        return false;
    }
    return true;
}

