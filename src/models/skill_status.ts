'use strict';
import validator from 'validator';
import Model from  '../lib/Model';

const tableFields = [
    'id',
    'campaign_id',
    'name',
    'description',
    'display_order',
    'display_to_pc',
    'class',
    'advanceable',
    'purchasable',
    'reviewable',
    'complete'
];

const SkillStatus = new Model('skill_statuses', tableFields, {
    order: ['display_order'],
    validator: validate
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}
export = SkillStatus;
