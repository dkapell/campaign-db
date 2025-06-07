'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'id',
    'campaign_id',
    'day',
    'start_hour',
    'start_minute',
    'length',
    'type'
];

const Timeslot = new Model('timeslots', tableFields, {
    order: ['day', 'start_hour', 'start_minute'],
    postSelect:fill
});

async function fill(data){
    const dayStr = data.day.charAt(0).toUpperCase() + data.day.slice(1);
    data.startStr = `${data.start_hour}:${String(data.start_minute).padStart(2, '0')}`;
    data.name = `${dayStr} - ${data.startStr}`;
    return data;
}

export = Timeslot;

