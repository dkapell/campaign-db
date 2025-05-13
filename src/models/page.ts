'use strict';
import validator from 'validator';
import database from '../lib/database';
import _ from 'underscore';

import Model from  '../lib/Model';

import page_codeModel from './page_code';

const models = {
    page_code: page_codeModel
};

const tableFields = [
    'id',
    'campaign_id',
    'name',
    'path',
    'show_full_menu',
    'menu',
    'content',
    'permission'
];

interface PageModel extends IModel {
   getForMenu?: (campaignId:number) => Promise<Record<string,ModelData[]>>
}
const Page: PageModel = new Model('pages', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: fill,
    postSave: saveCodes
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    if (! validator.isLength(data.path, {min:2, max:512})){
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

    const newCodes = [];
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

Page.getForMenu = async function getForMenu(campaignId:number): Promise<Record<string,ModelData[]>>{
    const query = 'select id, name, path, menu, permission from pages where campaign_id = $1 and menu is not null';
    const result = await database.query(query, [campaignId]);
    return _.groupBy(result.rows, 'menu');
}

export = Page;
