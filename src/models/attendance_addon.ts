'use strict';

import Model from  '../lib/Model';
import eventAddonModel from './event_addon';

const models = {
    event_addon: eventAddonModel
};

const tableFields = [
    'id',
    'campaign_id',
    'attendance_id',
    'event_addon_id',
    'paid',
    'cost'
];

const AttendeeAddon = new Model('attendance_addons', tableFields, {
    postSelect: fill,
    preSave: preSave
});

export = AttendeeAddon;

async function fill(record){
    record.addon = await models.event_addon.get(record.event_addon_id);
    return record;
}

async function preSave(data) {
    const addon = await models.event_addon.get(data.event_addon_id);
    if (!addon.pay_what_you_want){
        delete data.cost;
    } else if (addon.minimum > data.cost){
        data.cost = addon.minimum;
    }
    return data;
}
