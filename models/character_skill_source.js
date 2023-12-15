'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
    skill_source: require('./skill_source')
};

const tableFields = [
    'character_id',
    'skill_source_id',
    'updated',
    'cost',
];

exports.find = async function(conditions){
    const queryParts = [];
    const queryData = [];
    for (const field of tableFields){
        if (_.has(conditions, field)){
            queryParts.push(field + ' = $' + (queryParts.length+1));
            queryData.push(conditions[field]);
        }
    }
    let query = 'select * from character_skill_sources';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by character_id, skill_source_id';
    const result = await database.query(query, queryData);
    return async.map(result.rows, fill);
};

exports.findOne = async function (conditions){
    const result = await exports.find(conditions);
    if (!result.length){ return null; }
    return fill(result[0]);
};

exports.create = async function(data){
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

    let query = 'insert into character_skill_sources (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ')';

    return database.query(query, queryData);
};

exports.update = async function(conditions, data){
    const conditionParts = [];
    const queryData = [];
    for (const field of tableFields){
        if (_.has(conditions, field)){
            conditionParts.push(field + ' = $' + (queryData.length+1));
            queryData.push(conditions[field]);
        }
    }

    const queryUpdates = [];
    for (const field of tableFields){
        if (_.has(data, field)){
            queryUpdates.push(field + ' = $' + (queryData.length+1));
            queryData.push(data[field]);
        }
    }

    let query = 'update character_skill_sources set ';
    query += queryUpdates.join(', ');
    query += ' where ' + conditionParts.join(' and ');

    return database.query(query, queryData);
};

exports.delete = async  function(conditions){
    const queryParts = [];
    const queryData = [];
    for (const field of tableFields){
        if (_.has(conditions, field)){
            queryParts.push(field + ' = $' + (queryParts.length+1));
            queryData.push(conditions[field]);
        }
    }
    let query = 'delete from character_skill_sources where ';
    if (queryParts.length){
        query +=  queryParts.join(' and ');
    }
    await database.query(query, queryData);

};

async function fill(record){
    record.skill_source = await models.skill_source.get(record.skill_source_id);
    return record;
}


