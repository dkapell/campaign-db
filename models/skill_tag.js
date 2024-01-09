'use strict';
const validator = require('validator');
const Model = require('../lib/Model');

const tableFields = ['id', 'campaign_id', 'name', 'description', 'display_to_pc', 'on_sheet', 'color', 'type'];

const SkillTag = new Model('skill_tags', tableFields, {
    validator: validate,
    sorter: function(a,b){
        if (a.type === 'category'){
            if (b.type === 'category'){
                return a.type.localeCompare(b.type);
            }
            return -1;
        } else if (b.type === 'category'){
            return 1;
        } else if (a.type !== b.type){
            return a.type.localeCompare(b.type);
        } else {
            return a.name.localeCompare(b.name);
        }
    }
});

module.exports = SkillTag;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
