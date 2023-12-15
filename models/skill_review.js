'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const cache = require('../lib/cache');
const validator = require('validator');
const moment = require('moment');

const models = {
    user: require('./user')
};

const tableFields = [
    'skill_id',
    'user_id',
    'content',
    'approved'
];

exports.get = async function(id){
    let skill_review = await cache.check('skill_review', id);
    if (skill_review){ return fill(skill_review); }
    const query = 'select * from skill_reviews where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        skill_review = result.rows[0];
        await cache.store('skill_review', id, skill_review);
        return fill(skill_review);
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
    let query = 'select * from skill_reviews';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by created';
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

    let query = 'insert into skill_reviews (';
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

    let query = 'update skill_reviews set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('skill_review', id);
};

exports.delete = async  function(id, cb){
    const query = 'delete from skill_reviews where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('skill_review', id);
};


function validate(data){
    if(!data.approved && !data.content){
        return false;
    }
    return true;
}

async function fill(record){
    if (record.user_id){
        record.user = await models.user.get(record.user_id);
    } else {
        record.user = null;
    }
    record.dateStr = moment(record.created).format('lll');
    return record;
}
