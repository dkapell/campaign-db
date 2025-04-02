'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'id',
    'campaign_id',
    'user_id',
    'survey_id',
    'event_id',
    'survey_definition',
    'data',
    'submitted',
    'submitted_at',
    'created',
    'updated'
];

const SurveyResponse = new Model('survey_response', tableFields, {
    skipAuditFields: ['created', 'updated']
});

export = SurveyResponse;
