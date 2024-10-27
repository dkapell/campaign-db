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
    'created',
    'hidden_fields'
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
    record.players = record.attendees.filter(attendee => {return attendee.user.type === 'player'});
    return record;
}

export = Event;


