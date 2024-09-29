'use strict';
const validator = require('validator');
const Model = require('../lib/Model');

const tableFields = ['id', 'campaign_id', 'name', 'display_order', 'num_free', 'display_on_sheet', 'display_in_header'];

const SkillSourceType = new Model('skill_source_types', tableFields, {
    order: ['display_order'],
    validator: validate
});

module.exports = SkillSourceType;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
