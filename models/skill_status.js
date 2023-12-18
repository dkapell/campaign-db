'use strict';
const validator = require('validator');
const Model = require('../lib/Model');

const tableFields = ['id', 'campaign_id', 'name', 'description', 'display_order', 'display_to_pc', 'class', 'advanceable', 'purchasable', 'reviewable'];

const SkillStatus = new Model('skill_statuses', tableFields, {
    order: ['display_order'],
    validator: validate
});

module.exports = SkillStatus;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
