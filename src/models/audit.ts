'use strict';
import _ from 'underscore';
import Model from  '../lib/Model';

import skillModel from './skill';
import skill_sourceModel from './skill_source';
import skill_source_typeModel from './skill_source_type';
import skill_usageModel from './skill_usage';
import skill_tagModel from './skill_tag';
import userModel from './user';
import characterModel from './character';
import mapModel from './map';
import rulebookModel from './rulebook';
import custom_fieldModel from './custom_field';
import cp_grantModel from './cp_grant';
import eventModel from './event';
import attendanceModel from './attendance';


const models = {
    skill: skillModel,
    skill_source: skill_sourceModel,
    skill_source_type: skill_source_typeModel,
    skill_usage: skill_usageModel,
    skill_tag: skill_tagModel,
    user: userModel,
    character: characterModel,
    map: mapModel,
    rulebook: rulebookModel,
    custom_field: custom_fieldModel,
    cp_grant: cp_grantModel,
    event: eventModel,
    attendance: attendanceModel
};

const tableFields =  ['id',
    'campaign_id',
    'user_id',
    'object_type',
    'object_id',
    'action',
    'data',
    'created'
];

const Audit = new Model('audits', tableFields, {
    order: ['created asc' ],
    postSelect: fill
});

/*
async function search(searchQuery, options){
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

async function fill(record){
    if (_.has(models, record.object_type)){
        try{
            record.object = await models[record.object_type].get(record.object_id);
        } catch (err){
            console.error(err);
            record.object = {};
        }
    } else {
        record.object = {};
    }

    if (record.user_id === -1){
        record.user = {name:'unknown'};
    } else {
        record.user = await models.user.get(record.campaign_id, record.user_id);
    }

    return record;
}

export = Audit;
