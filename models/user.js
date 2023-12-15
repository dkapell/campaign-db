'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const cache = require('../lib/cache');
const validator = require('validator');

const models = {
};

const tableFields = ['name', 'email', 'google_id', 'user_type', 'drive_folder', 'staff_drive_folder', 'notes'];


exports.get = async function(id){
    let user = await cache.check('user', id);
    if (user){ return user; }
    const query = 'select * from users where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        user = result.rows[0];
        await cache.store('user', id, user);
        return user;
    }
    return;
};

exports.getByEmail = async function(text){
    const query = 'select * from users where email = $1';
    const result = await database.query(query, [text]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};
exports.getByGoogleId = async function(text){
    const query = 'select * from users where google_id = $1';
    const result = await database.query(query, [text]);
    if (result.rows.length){
        return result.rows[0];
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
    let query = 'select * from users';
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
    const query = 'select * from users order by name';
    const result = await database.query(query);
    return result.rows;
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

    let query = 'insert into users (';
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

    let query = 'update users set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('user', id);
};

exports.delete = async  function(id, cb){
    const query = 'delete from users where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('user', id);
};

exports.findOrCreate = async function(data, cb){
    let user = await exports.getByGoogleId(data.google_id);
    if (user) {
        for (const field in data){
            if (_.has(user, field)){
                user[field] = data[field];
            }
        }
        await exports.update(user.id, user);
        return await exports.get(user.id);

    } else {
        user = await exports.getByEmail(data.email);

        if (user) {
            for (const field in data){
                if (_.has(user, field)){
                    user[field] = data[field];
                }
            }
            await exports.update(user.id, user);
            return await exports.get(user.id);

        } else {
            const id = await exports.create(data);

            return await exports.get(id, cb);
        }
    }
};


function validate(data){
    if (_.has(data, 'name') && ! validator.isLength(data.name, 2, 255)){
        return false;
    }
    if (_.has(data, 'email') && ! validator.isLength(data.email, 3, 100)){
        return false;
    }
    return true;
}
