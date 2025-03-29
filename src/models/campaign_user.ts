'use strict';

import Model from  '../lib/Model';

const tableFields = ['campaign_id', 'user_id', 'name', 'type', 'created', 'drive_folder', 'staff_drive_folder', 'notes', 'permissions'];

const CampaignUser = new Model('campaigns_users', tableFields, {
    keyFields: ['campaign_id', 'user_id'],
    order: ['user_id', 'campaign_id']
});

export = CampaignUser;
