'use strict';
const validator = require('validator');
const Model = require('../lib/Model');


const tableFields = [
    'id',
    'page_id',
    'code'
];

const PageCode = new Model('page_codes', tableFields, {
    order: ['code'],
    validator: validate
});

module.exports = PageCode;

function validate(data){
    if (! validator.isLength(data.code, 2, 512)){
        return false;
    }
    return true;
}

