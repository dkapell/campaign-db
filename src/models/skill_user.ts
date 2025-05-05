'use strict';

import Model from '../lib/Model';

const tableFields = [
    'skill_id',
    'user_id',
    'created'
];

const SkillUser = new Model('skills_users', tableFields, {
    keyFields: ['skill_id', 'user_id'],
    order: ['skill_id', 'user_id'],
});

export = SkillUser;
