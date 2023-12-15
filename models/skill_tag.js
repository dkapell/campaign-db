'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const cache = require('../lib/cache');
const validator = require('validator');

const models = {
};

const tableFields = ['name', 'description', 'display_to_pc', 'on_sheet', 'color'];

exports.get = async function(id){
    let skill_tag = await cache.check('skill_tag', id);
    if (skill_tag){ return skill_tag; }
    const query = 'select * from skill_tags where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        skill_tag = result.rows[0];
        await cache.store('skill_tag', id, skill_tag);
        return skill_tag;
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
    let query = 'select * from skill_tags';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by name';
    const result = await database.query(query, queryData);
    return result.rows;
};

exports.findOne = async function (conditions){
    const result = await exports.find(conditions);
    if (!result.length){ return null; }
    return result[0];
};

exports.list = async function(){
    let skill_tags = await cache.check('skill_tag', 'list');
    if (skill_tags){ return skill_tags; }
    skill_tags = await exports.find({});
    await cache.store('skill_tag', 'list', skill_tags);
    return skill_tags;
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

    let query = 'insert into skill_tags (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    await cache.invalidate('skill_tag', 'list');
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

    let query = 'update skill_tags set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('skill_tag', id);
    await cache.invalidate('skill_tag', 'list');
};

exports.delete = async  function(id, cb){
    const query = 'delete from skill_tags where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('skill_tag', id);
    await cache.invalidate('skill_tag', 'list');
};


function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
