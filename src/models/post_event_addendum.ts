'use strict';

import Model from  '../lib/Model';

const tableFields = [
    'id',
    'campaign_id',
    'user_id',
    'attendance_id',
    'content',
    'submitted',
    'submitted_at',
    'created',
    'updated'
];

const PostEventAddendum = new Model('post_event_addendum', tableFields, {
    skipAuditFields: ['created', 'updated'],
    order: ['created']
});

export = PostEventAddendum;
