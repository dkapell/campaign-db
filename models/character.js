'use strict';

const validator = require('validator');
const Model = require('../lib/Model');

const tableFields = [
    'id',
    'campaign_id',
    'name',
    'pronouns',
    'user_id',
    'active',
    'cp',
    'updated',
    'extra_traits'
];

const Character = new Model('characters', tableFields, {
    order: ['name'],
    validator: validate
});

module.exports = Character;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}



