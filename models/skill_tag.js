'use strict';
const validator = require('validator');
const Model = require('../lib/Model');

const tableFields = ['id', 'campaign_id', 'name', 'description', 'display_to_pc', 'on_sheet', 'color'];

const SkillTag = new Model('skill_tags', tableFields, {
    validator: validate
});

module.exports = SkillTag;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
