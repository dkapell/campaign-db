'use strict';
const async = require('async');
const _ = require('underscore');
const cache = require('../lib/cache');
const database = require('../lib/database');
const validator = require('validator');

const models = {
    skill: require('./skill')
};

const tableFields = [
    'character_id',
    'skill_id',
    'details',
    'updated',
    'cost'
];

exports.get = async function(id){
    let character_skill = await cache.check('character_skill', id);
    if (character_skill){ return fill(character_skill); }
    const query = 'select * from character_skills where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        character_skill = result.rows[0];
        await cache.store('character_skill', id, character_skill);
        return fill(character_skill);
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
    let query = 'select * from character_skills';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by character_id, skill_id, updated';
    const result = await database.query(query, queryData);
    return async.map(result.rows, fill);
};

exports.findOne = async function (conditions){
    const result = await exports.find(conditions);
    if (!result.length){ return null; }
    return fill(result[0]);
};

exports.list = async function(){
    return exports.find({});
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

    let query = 'insert into character_skills (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    return result.rows[0].id;
};

exports.update = async function(id, data){
    const queryUpdates = [];
    const queryData = [id];
    for (const field of tableFields){
        if (_.has(data, field)){
            queryUpdates.push(field + ' = $' + (queryUpdates.length+2));
            queryData.push(data[field]);
        }
    }

    let query = 'update character_skills set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('character_skill', id);
};

exports.delete = async  function(id){
    const query = 'delete from character_skills where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('character_skill', id);
};

async function fill(record){
    record.skill = await models.skill.get(record.skill_id);
    return record;
}


