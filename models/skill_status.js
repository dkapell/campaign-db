'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const cache = require('../lib/cache');
const validator = require('validator');

const models = {
};

const tableFields = [
    'name', 'description', 'display_order', 'display_to_pc', 'class', 'advanceable', 'purchasable'];

exports.get = async function(id){
    let skill_status = await cache.check('skill_status', id);
    if (skill_status){ return skill_status; }
    const query = 'select * from skill_statuses where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        skill_status = result.rows[0];
        await cache.store('skill_status', id, skill_status);
        return skill_status;
    }
    return;
};

exports.find = async function(conditions, options){
    const queryParts = [];
    const queryData = [];
    if (!options) { options = {}; }
    for (const field of tableFields){
        if (_.has(conditions, field)){
            queryParts.push(field + ' = $' + (queryParts.length+1));
            queryData.push(conditions[field]);
        }
    }
    let query = 'select * from skill_statuses';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by display_order, name';
    if (options.limit){
        query += ` limit ${Number(options.limit)}`;
    }
    if (options.offset){
        query += ` offset ${Number(options.offset)}`;
    }
    const result = await database.query(query, queryData);
    return result.rows;
};

exports.findOne = async function (conditions){
    const result = await exports.find(conditions);
    if (!result.length){ return null; }
    return result[0];
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

    let query = 'insert into skill_statuses (';
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

    let query = 'update skill_statuses set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('skill_status', id);
};

exports.delete = async  function(id, cb){
    const query = 'delete from skill_statuses where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('skill_status', id);
};

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
