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
    'event_id',
    'user_id',
    'character_id',
    'paid',
    'notes',
    'created'
];

const Attendance = new Model('attendance', tableFields, {
    postSelect: fill
});

async function fill(record){
    if (record.user_id){
        record.user = await models.user.get(record.user_id);
    }
    if (record.character_id){
        record.character = await models.character.get(record.character_id);
    }
    return record;
}

export = Attendance;


