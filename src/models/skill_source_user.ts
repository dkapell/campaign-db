'use strict';

import Model from '../lib/Model';

const tableFields = [
    'source_id',
    'user_id',
    'created'
];

const SkillSourceUser = new Model('skill_sources_users', tableFields, {
    keyFields: ['source_id', 'user_id'],
    order: ['source_id', 'user_id'],
});

export = SkillSourceUser;
