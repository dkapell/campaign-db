'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'id',
    'campaign_id',
    'day',
    'start_hour',
    'start_minute',
    'length',
    'type',
    'display_name',
    'nighttime'
];

const Timeslot = new Model('timeslots', tableFields, {
    order: ['day', 'start_hour', 'start_minute'],
    postSelect:fill
});

async function fill(data){
    const dayStr = data.day.charAt(0).toUpperCase() + data.day.slice(1);
    data.startStr = `${data.start_hour}:${String(data.start_minute).padStart(2, '0')}`;
    data.name = `${dayStr} - ${data.startStr}`;
    if (data.display_name){
        data.name += ` (${data.display_name})`;
    }
    return data;
}

export = Timeslot;

