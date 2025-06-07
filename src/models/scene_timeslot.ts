'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'scene_id',
    'timeslot_id',
    'request_status',
    'schedule_status'
];

const SceneTimeslot = new Model('scenes_timeslots', tableFields, {
    keyFields: ['scene_id', 'timeslot_id']
});

export = SceneTimeslot;
