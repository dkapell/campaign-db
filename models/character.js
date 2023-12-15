'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const cache = require('../lib/cache');
const validator = require('validator');

const models = {};

const tableFields = [
    'name',
    'user_id',
    'active',
    'cp',
    'updated',
    'extra_traits',
    'foreordainment'
];

exports.get = async function(id){
    let character = await cache.check('character', id);
    if (character){ return character; }
    const query = 'select * from characters where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        character = result.rows[0];
        await cache.store('character', id, character);
        return character;
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
    let query = 'select * from characters';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by name';
    const result = await database.query(query, queryData);
    return result.rows;
};

exports.findOne = async function(conditions){
    const result = await exports.find(conditions);
    if (!result.length){ return null; }
    return result[0];
};

exports.list = async function(){
    return exports.find({});
};

exports.create = async function(data){
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

    let query = 'insert into characters (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    return result.rows[0].id;
};

exports.update = async function(id, data){
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

    let query = 'update characters set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('character', id);
};

exports.delete = async  function(id){
    const query = 'delete from characters where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('character', id);
};


function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}



