'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const cache = require('../lib/cache');
const validator = require('validator');

const models = {
};

const tableFields = ['name', 'display_order', 'num_free'];

exports.get = async function(id){
    let skill_source_type = await cache.check('skill_source_type', id);
    if (skill_source_type){ return skill_source_type; }
    const query = 'select * from skill_source_types where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        skill_source_type = result.rows[0];
        await cache.store('skill_source_type', id, skill_source_type);
        return skill_source_type;
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
    let query = 'select * from skill_source_types';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by display_order';
    const result = await database.query(query, queryData);
    return result.rows;
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

    let query = 'insert into skill_source_types (';
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

    let query = 'update skill_source_types set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('skill_source_type', id);
};

exports.delete = async  function(id, cb){
    const query = 'delete from skill_source_types where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('skill_source_type', id);
};


function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
