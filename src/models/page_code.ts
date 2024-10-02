'use strict';
import validator from 'validator';
import Model from  '../lib/Model';


const tableFields = [
    'id',
    'page_id',
    'code'
];

const PageCode = new Model('page_codes', tableFields, {
    order: ['code'],
    validator: validate
});

function validate(data){
    if (! validator.isLength(data.code, {min:2, max:512})){
        return false;
    }
    return true;
}

export = PageCode;
