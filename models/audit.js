'use strict';
const _ = require('underscore');
const Model = require('../lib/Model');

const models = {
    skill: require('./skill'),
    skill_source: require('./skill_source'),
    skill_source_type: require('./skill_source_type'),
    skill_usage: require('./skill_usage'),
    skill_tag: require('./skill_tag'),
    user: require('./user'),
    character: require('./character'),
    map: require('./map'),
    rulebook: require('./rulebook'),
    custom_field: require('./custom_field')
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

module.exports = Audit;

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
        record.user = await models.user.get(record.campaign_id, record.user_id);
    }

    return record;
}
