'use strict';

import validator from 'validator';
import Model from  '../lib/Model';
import attendanceModel from './attendance';

const models = {
    attendance: attendanceModel
};

const tableFields = [
    'id',
    'campaign_id',
    'name',
    'description',
    'start_time',
    'end_time',
    'registration_open',
    'cost',
    'location',
    'deleted',
    'created'
];

const Event = new Model('events', tableFields, {
    order: ['start_time'],
    validator: validate,
    postSelect: fill
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

async function fill(record){
    record.attendees = await models.attendance.find({event_id:record.id});
    return record;
}

export = Event;

