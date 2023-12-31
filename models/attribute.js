'use strict';
const validator = require('validator');
const Model = require('../lib/Model');


const tableFields = [
    'id',
    'campaign_id',
    'name',
    'description',
    'initial',
    'display_order'
];

const Attribute = new Model('attributes', tableFields, {
    order: ['display_order'],
    validator: validate
});

module.exports = Attribute;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}

