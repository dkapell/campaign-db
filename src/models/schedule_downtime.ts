'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'id',
    'campaign_id',
    'timeslot_id',
    'user_id',
    'event_id'
];

const ScheduleDowntime = new Model('schedule_downtime', tableFields, {});

export = ScheduleDowntime;
