'use strict';

import Model from  '../lib/Model';

import scheduleBusyTypeModel from './schedule_busy_type'

const models = {
    schedule_busy_type: scheduleBusyTypeModel
};

const tableFields = [
    'id',
    'timeslot_id',
    'user_id',
    'event_id',
    'type_id'
];

const ScheduleBusy = new Model('schedule_busies', tableFields, {
    postSelect: fill
});

async function fill(data){
    data.type = await models.schedule_busy_type.get(data.type_id);
    data.name = data.type.name;
    return data;
}

export = ScheduleBusy;
