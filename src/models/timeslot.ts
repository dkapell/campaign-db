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
    let afternoon = false;
    let hour = data.start_hour;
    if (data.start_hour > 12){
        hour -= 12;
        afternoon = true;
    }

    data.startStr = `${hour}:${String(data.start_minute).padStart(2, '0')}${afternoon?'pm':'am'}`;
    data.name = `${dayStr} - ${data.startStr}`;
    return data;
}

export = Timeslot;

