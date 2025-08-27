'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'id',
    'survey_response_id',
    'scene_id',
    'gm_feedback',
    'npc_feedback',
    'skipped',
    'created'
];

const SceneFeedback = new Model('scenes_feedbacks', tableFields, {
    skipAuditFields: ['created']
});

export = SceneFeedback;
