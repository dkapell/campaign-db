'use strict';
import moment from 'moment';
import Model from  '../lib/Model';

import userModel from './user';

const models = {
    user: userModel
};

const tableFields = [
    'id',
    'campaign_id',
    'skill_id',
    'user_id',
    'content',
    'approved'
];

const SkillReview = new Model('skill_reviews', tableFields, {
    order: ['created'],
    validator: validate,
    postSelect: fill
});

function validate(data){
    if(!data.approved && !data.content){
        return false;
    }
    return true;
}

async function fill(record){
    if (record.user_id){
        record.user = await models.user.get(record.campaign_id, record.user_id);
    } else {
        record.user = null;
    }
    record.dateStr = moment(record.created).format('lll');
    return record;
}

export = SkillReview;

