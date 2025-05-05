'use strict';
import validator from 'validator';
import _ from 'underscore';
import Model from  '../lib/Model';

import skill_source_typeModel from './skill_source_type';
import skill_source_userModel from './skill_source_user';

const models = {
    source_type: skill_source_typeModel,
    source_user: skill_source_userModel
};


const tableFields = [
    'id',
    'campaign_id',
    'name',
    'description',
    'notes',
    'type_id',
    'cost',
    'provides',
    'requires',
    'require_num',
    'max_skills',
    'conflicts',
    'required',
    'display_to_pc',
    'display_to_staff'
];

const SkillSource = new Model('skill_sources', tableFields, {
    order: ['type_id', 'name'],
    validator: validate,
    postSelect: fill,
    postSave: postSave
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

async function fill(record:SourceModel){
    if (record.type_id){
        record.type = await models.source_type.get(record.type_id);
    } else {
        record.type = null;
    }
    return record;
}

async function postSave(id:number, data:SourceModel):Promise<void>{
    if (data.users){
        if (typeof data.users === 'string'){
            data.users = [data.users];
        }
        if (_.isNull(data.users)){
            data.users = [];
        }
        data.users = data.users.map(userId => { return Number(userId)});
        const current = _.pluck(await models.source_user.find({source_id:id}), 'user_id');

        for (const userId of data.users){
            if (_.indexOf(current, userId) === -1){
                await models.source_user.create({source_id:id, user_id:userId});
            }
        }
        for (const userId of current){
            if (_.indexOf(data.users, Number(userId)) === -1){
                await models.source_user.delete({source_id:id, user_id:Number(userId)});
            }
        }
    }
    return;
}

export = SkillSource;

