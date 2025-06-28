'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'scene_id',
    'skill_id',
    'request_status',
    'details'
];

const SceneSkill = new Model('scenes_skills', tableFields, {
    keyFields: ['scene_id', 'skill_id']
});

export = SceneSkill;
