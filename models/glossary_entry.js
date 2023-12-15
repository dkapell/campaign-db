'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const cache = require('../lib/cache');
const validator = require('validator');

const models = {
    tag: require('./glossary_tag'),
    status: require('./glossary_status')
};

const tableFields = ['name', 'content', 'created', 'status_id', 'type'];

exports.get = async function(id){
    let glossary_entry = await cache.check('glossary_entry', id);
    if (glossary_entry){ return fill(glossary_entry); }
    const query = 'select * from glossary_entries where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        glossary_entry = result.rows[0];
        await cache.store('glossary_entry', id, glossary_entry);
        return fill(glossary_entry);
    }
    return;
};

exports.getByName = async function(name){
    let glossary_entry = await cache.check('glossary_entry-name', name);
    if (glossary_entry){ return glossary_entry; }
    const query = 'select * from glossary_entries where name = $1';
    const result = await database.query(query, [name]);
    if (result.rows.length){
        glossary_entry = result.rows[0];
        await cache.store('glossary_entry-name', name, glossary_entry);
        return fill(glossary_entry);
    }
    return;
};

exports.find = async function(conditions){
    const queryParts = [];
    const queryData = [];
    for (const field of tableFields){
        if (_.has(conditions, field)){
            queryParts.push(field + ' = $' + (queryParts.length+1));
            queryData.push(conditions[field]);
        }
    }
    let query = 'select * from glossary_entries';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by name';
    const result = await database.query(query, queryData);
    return async.mapLimit(result.rows, 10, fill);
};

exports.findOne = async function(conditions) {
    const result = await exports.find(conditions);
    if (result.length) {
        return result[0];
    }
    return null;
};

exports.list = async function(){
    return exports.find({});
};

exports.listByTag = async function(tagId){
    let query  = 'select glossary_entries.* from glossary_entries ';
    query += 'right join glossary_entry_tag on glossary_entry_tag.entry_id = glossary_entries.id ';
    query += 'where glossary_entry_tag.tag_id = $1 order by name';
    const result = await database.query(query, [tagId]);
    return async.mapLimit(result.rows, 10, fill);
};

exports.search = async function(searchQuery){
    const query = 'select * from glossary_entries where name like $1 or content like $1';
    const result = await database.query(query, [`%${searchQuery}%`]);
    return async.mapLimit(result.rows, 10, fill);
};

exports.create = async function(data, cb){
    if (! validate(data)){
        throw new Error('Invalid Data');
    }
    const queryFields = [];
    const queryData = [];
    const queryValues = [];
    for (const field of tableFields){
        if (_.has(data, field)){
            queryFields.push(field);
            queryValues.push('$' + queryFields.length);
            queryData.push(data[field]);
        }
    }

    let query = 'insert into glossary_entries (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    const id = result.rows[0].id;
    if (_.has(data, 'tags')){
        await saveTags(id, data.tags);
    }
    return id;
};

exports.update = async function(id, data, cb){
    if (! validate(data)){
        throw new Error('Invalid Data');
    }
    const queryUpdates = [];
    const queryData = [id];
    for (const field of tableFields){
        if (_.has(data, field)){
            queryUpdates.push(field + ' = $' + (queryUpdates.length+2));
            queryData.push(data[field]);
        }
    }

    let query = 'update glossary_entries set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    if (_.has(data, 'tags')){
        await saveTags(id, data.tags);
    }
    await cache.invalidate('glossary_entry', id);
};

exports.delete = async  function(id, cb){
    const query = 'delete from glossary_entries where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('glossary_entry', id);
};

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

async function saveTags(entry_id, tags){
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
            const tag = await models.tag.getByName(tagId);
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
