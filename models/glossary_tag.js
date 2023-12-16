'use strict';
const validator = require('validator');
const Model = require('../lib/Model');

const tableFields = ['id', 'campaign_id', 'name'];

const GlossaryTag = new Model('glossary_tags', tableFields, {
    order: ['name'],
    validator: validate
});

module.exports = GlossaryTag;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
