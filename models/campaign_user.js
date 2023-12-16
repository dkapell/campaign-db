'use strict';

const Model = require('../lib/Model');

const tableFields = ['campaign_id', 'user_id', 'type', 'created', 'drive_folder', 'staff_drive_folder', 'notes'];

const CampaignUser = new Model('campaigns_users', tableFields, {
    keyFields: ['campaign_id', 'user_id'],
    order: ['user_id', 'campaign_id']
});

module.exports = CampaignUser;
