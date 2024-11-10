'use strict';

import Model from  '../lib/Model';

import userModel from './user';
import characterModel from './character';

const models = {
    user: userModel,
    character: characterModel
};

const tableFields = [
    'id',
    'campaign_id',
    'event_id',
    'user_id',
    'character_id',
    'paid',
    'notes',
    'data',
    'created'
];

const Attendance = new Model('attendance', tableFields, {
    postSelect: fill,
    skipAuditFields: ['event_id', 'created']
});

async function fill(record){
    if (record.user_id){
        record.user = await models.user.get(record.campaign_id, record.user_id);
    }
    if (record.character_id){
        record.character = await models.character.get(record.character_id);
    }
    return record;
}

export = Attendance;


