'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'scene_id',
    'location_id',
    'request_status',
    'schedule_status'
];

const SceneLocation = new Model('scenes_locations', tableFields, {
    keyFields: ['scene_id', 'location_id']
});

export = SceneLocation;
