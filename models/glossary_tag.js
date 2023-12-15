'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const cache = require('../lib/cache');
const validator = require('validator');

const models = {
};

const tableFields = ['name'];

exports.get = async function(id){
    let glossary_tag = await cache.check('glossary_tag', id);
    if (glossary_tag){ return glossary_tag; }
    const query = 'select * from glossary_tags where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        glossary_tag = result.rows[0];
        await cache.store('glossary_tag', id, glossary_tag);
        return glossary_tag;
    }
    return;
};

exports.getByName = async function(name){
    let glossary_tag = await cache.check('glossary_tag-name', name);
    if (glossary_tag){ return glossary_tag; }
    const query = 'select * from glossary_tags where name = $1';
    const result = await database.query(query, [name]);
    if (result.rows.length){
        glossary_tag = result.rows[0];
        await cache.store('glossary_tag-name', name, glossary_tag);
        return glossary_tag;
    } else {
        const id = await exports.create({name:name});
        return exports.get(id);
    }
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
    let query = 'select * from glossary_tags';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by name';
    const result = await database.query(query, queryData);
    return result.rows;
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

    let query = 'insert into glossary_tags (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    return result.rows[0].id;
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

    let query = 'update glossary_tags set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('glossary_tag', id);
};

exports.delete = async  function(id, cb){
    const query = 'delete from glossary_tags where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('glossary_tag', id);
};

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
