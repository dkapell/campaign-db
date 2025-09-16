'use strict';
import validator from 'validator';
import Model from  '../lib/Model';

const tableFields = [
    'id',
    'campaign_id',
    'name',
    'category',
    'display_order',
    'num_free',
    'max_sources',
    'max_category',
    'display_on_sheet',
    'display_in_header',
    'on_scene_user_picker'
];

const SkillSourceType = new Model('skill_source_types', tableFields, {
    order: ['display_order'],
    validator: validate
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

export = SkillSourceType;
