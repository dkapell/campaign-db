'use strict';
import _ from 'underscore';
import async from 'async';
import Model from  '../lib/Model';
import database from '../lib/database';


import tagModel from './tag';

const models = {
    tag: tagModel
}

const tableFields = [
    'id',
    'campaign_id',
    'name',
    'display_order',
    'multiple_scenes',
    'combat'
];

const Location = new Model('locations', tableFields, {
    order: ['display_order'],
    postSelect: fill,
    postSave:saveTags,
});

async function fill(record){
    record.tags = await getTags(record.id);

    return record;
}

async function getTags(locationId: number){
    const query = 'select * from locations_tags where location_id = $1';
    const result = await database.query(query, [locationId]);
    const tags = await async.map(result.rows, async location_tag => {
        return models.tag.get(location_tag.tag_id);
    });

    return _.sortBy(tags, 'name');
}

async function saveTags(locationId:number, data:ModelData){

    if (!_.has(data, 'tags')){
        return;
    }

    const tags = data.tags;
    const currentQuery  = 'select * from locations_tags where location_id = $1';
    const insertQuery = 'insert into locations_tags (location_id, tag_id) values ($1, $2)';
    const deleteQuery = 'delete from locations_tags where location_id = $1 and tag_id = $2';
    const current = await database.query(currentQuery, [locationId]);

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
            const tag = await models.tag.getByName('location', tagId, (data.campaign_id as number));
            return tag.id;
        }
        return Number(tagId);
    });

    for (const tagId of newTags){
        if(!_.findWhere(current.rows, {tag_id: tagId})){
            await database.query(insertQuery, [locationId, tagId]);
        }
    }

    for (const row of current.rows){
        if(_.indexOf(newTags, row.tag_id) === -1){
            await database.query(deleteQuery, [locationId, row.tag_id]);
        }
    }
}

export = Location;

