'use strict';

import Model from  '../lib/Model';

import _ from 'underscore';
import async from 'async';
import database from '../lib/database';

import tagModel from './tag';

const models = {
    tag: tagModel
};

const tableFields = [
    'campaign_id',
    'user_id',
    'name',
    'type',
    'created',
    'drive_folder',
    'staff_drive_folder',
    'notes',
    'permissions',
    'image_id',
    'occasional_attendee',
    'calendar_id',
    'last_login',
    'data'
];

const CampaignUser = new Model('campaigns_users', tableFields, {
    keyFields: ['campaign_id', 'user_id'],
    order: ['user_id', 'campaign_id'],
    postSelect:fill,
    postSave: postSave
});

async function fill(record){
    record.tags = await getTags(record);
    return record;
}

async function postSave(id, data){
    await saveTags(data);
    return;
}

async function getTags(data:ModelData){
    const query = 'select * from campaign_users_tags where user_id = $1 and campaign_id = $2';
    const result = await database.query(query, [data.user_id, data.campaign_id]);
    const tags = await async.map(result.rows, async campaign_user_tag => {
        return models.tag.get(campaign_user_tag.tag_id);
    });

    return _.sortBy(tags, 'name');
}

async function saveTags(data:ModelData){

    if (!_.has(data, 'tags')){
        return;
    }

    const tags = data.tags;
    const currentQuery  = 'select * from campaign_users_tags where user_id = $1 and campaign_id = $2';
    const insertQuery = 'insert into campaign_users_tags (user_id, campaign_id, tag_id) values ($1, $2, $3)';
    const deleteQuery = 'delete from campaign_users_tags where user_id = $1 and campaign_id = $2 and tag_id = $3';
    const current = await database.query(currentQuery, [data.user_id, data.campaign_id]);

    let newTags = [];
    for (const tag of (tags as object[])){
        if (_.isObject(tag)){
            newTags.push(tag.id);
        } else {
            newTags.push(tag);
        }
    }

    newTags = await async.map(newTags, async tagId => {
        if (isNaN(tagId)){
            const tag = await models.tag.getByName('user', tagId, (data.campaign_id as number));
            return tag.id;
        }
        return Number(tagId);
    });

    for (const tagId of newTags){
        if(!_.findWhere(current.rows, {tag_id: tagId})){
            await database.query(insertQuery, [data.user_id, data.campaign_id, tagId]);
        }
    }

    for (const row of current.rows){
        if(_.indexOf(newTags, row.tag_id) === -1){
            await database.query(deleteQuery, [data.user_id, data.campaign_id, row.tag_id]);
        }
    }
}


export = CampaignUser;
