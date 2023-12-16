'use strict';
const validator = require('validator');
const Model = require('../lib/Model');

const tableFields = ['id', 'campaign_id', 'name', 'description'];

const SkillType = new Model('skill_types', tableFields, {
    order: ['name'],
    validator: validate
});

module.exports = SkillType;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
