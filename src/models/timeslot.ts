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
    let startAfternoon = false;
    let startHour = data.start_hour;
    if (data.start_hour > 11){
        startAfternoon = true;
    }
    if (data.start_hour > 12){
        startHour -= 12;
    }

    data.startStr = `${startHour}:${String(data.start_minute).padStart(2, '0')}${startAfternoon?'pm':'am'}`;

    data.name = `${dayStr} - ${data.startStr}`;
    let endAfternoon = false
    let endHour = Math.floor(data.start_hour + data.start_minute/60 + data.length/60);
    if (endHour > 11){
        endAfternoon = true;
    }
    if (endHour > 12){
        endHour -= 12;
    }
    const endMins = (data.start_minute + data.length)%60;

    data.endStr = `${endHour}:${String(endMins).padStart(2, '0')}${endAfternoon?'pm':'am'}`;
    data.endName = `${dayStr} - ${data.endStr}`;
    return data;
}

export = Timeslot;

