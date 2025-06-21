'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'id',
    'scene_id',
    'level',
    'code',
    'text',
    'ignored',
    'resolved',
    'created'
];

const SceneIssues = new Model('scene_issues', tableFields, {
    order: ['scene_id', 'level', 'text']
});

export = SceneIssues;
