'use strict';
import validator from 'validator';
import Model from  '../lib/Model';

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
            return (a.type as string).localeCompare(b.type as string);
        } else {
            return (a.name as string).localeCompare(b.name as string);
        }
    }
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}
export = SkillTag;
