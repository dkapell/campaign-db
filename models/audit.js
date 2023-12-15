'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const cache = require('../lib/cache');
const validator = require('validator');

const models = {
    skill: require('./skill'),
    skill_source: require('./skill_source'),
    skill_source_type: require('./skill_source_type'),
    skill_usage: require('./skill_usage'),
    skill_type: require('./skill_type'),
    skill_tag: require('./skill_tag'),
    user: require('./user'),
    character: require('./character')
};

const tableFields = ['user_id', 'object_type', 'object_id', 'action', 'data'];

exports.get = async function(id){
    let audit = await cache.check('audit', id);
    if (audit){ return fill(audit); }
    const query = 'select * from audits where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        audit = result.rows[0];
        await cache.store('audit', id, audit);
        return fill(audit);
    }
    return;
};

exports.find = async function(conditions, options){
    const queryParts = [];
    const queryData = [];
    for (const field of tableFields){
        if (_.has(conditions, field)){
            queryParts.push(field + ' = $' + (queryParts.length+1));
            queryData.push(conditions[field]);
        }
    }
    let query = 'select';
    if (options && options.count){
        query += ' count(*)';
    } else {
        query += ' *';
    }
    query += ' from audits';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }

    if (options && _.has(options, 'order')){
        query += ` order by ${options.order.join(', ')}`;
    } else if (!options || !options.count){
        query += ' order by created asc';
    }

    if (options && _.has(options, 'limit') && options.limit){
        query += ` limit ${options.limit}`;
    }
    if (options && _.has(options, 'offset')){
        query += ` offset ${options.offset}`;
    }
    const result = await database.query(query, queryData);
    if (options && options.count){
        return result.rows[0].count;
    }
    return async.map(result.rows, fill);
};

exports.list = async function(){
    return exports.find({});
};

exports.count = async function(conditions, options){
    if (!conditions){
        conditions = {};
    }
    if (!options){
        options = {};
    }
    options.count = true;
    return exports.find(conditions, options);
};

/*
exports.search = async function(searchQuery, options){
    const queryData = [];

    let query = 'select';
    if (options && options.count){
        query += ' count(*)';
    } else {
        query += ' audits.*';
    }
    query += ' from audits';
    query += ' left join users on audits.user_id = users.id';

    query += ' where';
    query += ' upper(users.name) = upper($1)';
    query += ' or upper(audit.object_type) = upper($1)';

    for (const table in models){
        const objects = await.find({name:searchQuery})
    }

    //query += ' upper(o.name) = upper($1)';

    if (!options ||!options.count){
        query += ' order by created desc';
    }
    if (options && _.has(options, 'limit') && options.limit){
        query += ` limit ${options.limit}`;
    }
    if (options && _.has(options, 'offset')){
        query += ` offset ${options.offset}`;
    }
    console.log(query)
    const result = await database.query(query, [searchQuery]);
    if (options && options.count){
        return result.rows[0].count;
    }
    return async.map(result.rows, fill);
};*/

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

    let query = 'insert into audits (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    const id = result.rows[0].id;
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

    let query = 'update audits set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('audit', id);
};

exports.delete = async  function(id, cb){
    const query = 'delete from audits where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('audit', id);
};


function validate(data){
    return true;
}

async function fill(record){
    if (_.has(models, record.object_type)){
        try{
            record.object = await models[record.object_type].get(record.object_id);
        } catch (e){
            record.object = {};
        }
    } else {
        record.object = {};
    }

    if (record.user_id === -1){
        record.user = {name:'unknown'};
    } else {
        record.user = await models.user.get(record.user_id);
    }

    return record;
}
