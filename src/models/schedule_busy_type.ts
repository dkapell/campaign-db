'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'id',
    'campaign_id',
    'name',
    'description',
    'display_to_player',
    'available_to_player',
    'available_to_staff'
];

const ScheduleBusyType = new Model('schedule_busy_types', tableFields, {
    order: ['name']
});

export = ScheduleBusyType;
