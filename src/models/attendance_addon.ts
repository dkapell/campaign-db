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
    'paid'
];

const AttendeeAddon = new Model('attendance_addons', tableFields, {
    postSelect: fill
});

export = AttendeeAddon;

async function fill(record){
    record.addon = await models.event_addon.get(record.event_addon_id);
    return record;
}
