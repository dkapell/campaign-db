'use strict';
const validator = require('validator');
const database = require('../lib/database');
const _ = require('underscore');

const Model = require('../lib/Model');

const models = {
    page_code: require('./page_code')
};

const tableFields = [
    'id',
    'campaign_id',
    'name',
    'path',
    'show_full_menu',
    'content'
];


const Page = new Model('pages', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: fill,
    postSave: saveCodes
});

module.exports = Page;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    if (! validator.isLength(data.path, 2, 512)){
        return false;
    }
    return true;
}

async function fill(record){
    record.codes = _.pluck(await models.page_code.find({page_id: record.id}), 'code');
    return record;
}

async function saveCodes(pageId, data){

    if (!_.has(data, 'codes')){
        return;
    }

    const codes = data.codes;
    const currentQuery  = 'select * from page_codes where page_id = $1';
    const insertQuery = 'insert into page_codes (page_id, code) values ($1, $2)';
    const deleteQuery = 'delete from page_codes where page_id = $1 and code = $2';
    const current = await database.query(currentQuery, [pageId]);

    let newCodes = [];
    for (const code of codes){
        if (_.isObject(code)){
            newCodes.push(code.code);
        } else {
            newCodes.push(code);
        }
    }

    for (const code of newCodes){
        if(!_.findWhere(current.rows, {code: code})){
            await database.query(insertQuery, [pageId, code]);
        }
    }

    for (const row of current.rows){
        if(_.indexOf(newCodes, row.code) === -1){
            await database.query(deleteQuery, [pageId, row.code]);
        }
    }
}
