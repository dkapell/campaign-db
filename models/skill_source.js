'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const cache = require('../lib/cache');
const validator = require('validator');

const models = {
    source_type: require('./skill_source_type')
};

const tableFields = [
    'name',
    'description',
    'notes',
    'type_id',
    'cost',
    'provides',
    'requires',
    'require_num',
    'conflicts',
    'required',
    'display_to_pc'
];

exports.get = async function(id){
    let skill_source = await cache.check('skill_source', id);
    if (skill_source){ return fill(skill_source); }
    const query = 'select * from skill_sources where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        skill_source = result.rows[0];
        await cache.store('skill_source', id, skill_source);
        return fill(skill_source);
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
    let query = 'select * from skill_sources';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by type_id, name';
    const result = await database.query(query, queryData);
    return async.map(result.rows, fill);
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

    let query = 'insert into skill_sources (';
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

    let query = 'update skill_sources set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('skill_source', id);
};

exports.delete = async  function(id, cb){
    const query = 'delete from skill_sources where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('skill_source', id);
};


function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}

async function fill(record){
    if (record.type_id){
        record.type = await models.source_type.get(record.type_id);
    } else {
        record.type = null;
    }
    return record;
}
