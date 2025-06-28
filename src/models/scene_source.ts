'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'scene_id',
    'source_id',
    'request_status',
    'details'
];

const SceneSource = new Model('scenes_sources', tableFields, {
    keyFields: ['scene_id', 'source_id']
});

export = SceneSource;
