'use strict';
const validator = require('validator');
const Model = require('../lib/Model');

const tableFields = ['id', 'campaign_id', 'name', 'description', 'display_name', 'display_order'];

const SkillUsage = new Model('skill_usages', tableFields, {
    order: ['display_order'],
    validator: validate
});

module.exports = SkillUsage;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
