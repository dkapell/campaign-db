'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'scene_id',
    'user_id',
    'request_status',
    'schedule_status'
];

const SceneUser = new Model('scenes_users', tableFields, {
    keyFields: ['scene_id', 'user_id']
});

export = SceneUser;
