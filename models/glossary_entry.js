
'use strict';
const async = require('async');
const _ = require('underscore');
const validator = require('validator');
const database = require('../lib/database');
const Model = require('../lib/Model');

const models = {
    tag: require('./glossary_tag'),
    status: require('./glossary_status')
};

const tableFields = ['id', 'campaign_id', 'name', 'content', 'created', 'status_id', 'type'];

const GlossaryEntry = new Model('glossary_entries', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: fill,
    postSave: saveTags

});


GlossaryEntry.listByTag = async function(tagId){
    let query  = 'select glossary_entries.* from glossary_entries ';
    query += 'right join glossary_entry_tag on glossary_entry_tag.entry_id = glossary_entries.id ';
    query += 'where glossary_entry_tag.tag_id = $1 order by name';
    const result = await database.query(query, [campaignId]);
    return async.mapLimit(result.rows, 10, fill);
};

GlossaryEntry.search = async function(campaignId, searchQuery){
    const query = 'select * from glossary_entries where campaignId = $1 and (name like $2 or content like $2)';
    const result = await database.query(query, [campaignId, `%${searchQuery}%`]);
    return async.mapLimit(result.rows, 10, fill);
};

module.exports = GlossaryEntry;


function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}

async function fill(record){
    if (record.status_id){
        record.status = await models.status.get(record.status_id);
    } else {
        record.status = null;
    }

    record.tags = await getTags(record.id);

    return record;
}

async function getTags(entry_id){
    const query = 'select * from glossary_entry_tag where entry_id = $1';
    const result = await database.query(query, [entry_id]);
    const tags = await async.map(result.rows, async entry_tag => {
        return models.tag.get(entry_tag.tag_id);
    });

    return _.sortBy(tags, 'name');
}

async function saveTags(entry_id, data){

    if (!_.has(data, 'tags')){
        return;
    }

    const tags = data.tags;
    const currentQuery  = 'select * from glossary_entry_tag where entry_id = $1';
    const insertQuery = 'insert into glossary_entry_tag (entry_id, tag_id) values ($1, $2)';
    const deleteQuery = 'delete from glossary_entry_tag where entry_id = $1 and tag_id = $2';
    const current = await database.query(currentQuery, [entry_id]);

    let newTags = [];
    for (const tag of tags){
        if (_.isObject(tag)){
            newTags.push(tag.id);
        } else {
            newTags.push(tag);
        }
    }

    newTags = await async.map(newTags, async tagId => {
        if (isNaN(tagId)){
            const tag = await models.tag.find({name:tagId});
            return tag.id;
        }
        return Number(tagId);
    });

    for (const tag_id of newTags){
        if(!_.findWhere(current.rows, {tag_id: tag_id})){
            await database.query(insertQuery, [entry_id, tag_id]);
        }
    }

    for (const row of current.rows){
        if(_.indexOf(newTags, row.tag_id) === -1){
            await database.query(deleteQuery, [entry_id, row.tag_id]);
        }
    }
}
