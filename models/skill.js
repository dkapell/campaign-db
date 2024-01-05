'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const cache = require('../lib/cache');
const validator = require('validator');

const models = {
    source: require('./skill_source'),
    usage: require('./skill_usage'),
    type: require('./skill_type'),
    tag: require('./skill_tag'),
    status: require('./skill_status')
};

const tableFields = [
    'campaign_id',
    'name',
    'summary',
    'description',
    'notes',
    'cost',
    'source_id',
    'usage_id',
    'type_id',
    'status_id',
    'provides',
    'requires',
    'require_num',
    'conflicts',
    'updated'
];

exports.get = async function(id){
    let skill = await cache.check('skill', id);
    if (skill){ return fill(skill); }
    const query = 'select skills.*, array_agg(tag_id) tags from skills left join skill_tags_xref on skills.id = skill_tags_xref.skill_id where id = $1 group by skills.id';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        skill = result.rows[0];
        await cache.store('skill', id, skill);
        const allTags = await models.tag.list();
        return fill(skill, allTags);
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
    let query = 'select skills.*, array_agg(tag_id) tags from skills left join skill_tags_xref on skills.id = skill_tags_xref.skill_id';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' group by skills.id';
    query += ' order by type_id, name';

    const result = await database.query(query, queryData);
    if (options && _.has(options, 'skipRelations') && options.skipRelations){
        return result.rows;
    } else {
        const data = {
            tags: await models.tag.list()
        };
        if (result.rows.length > 5){
            data.sources = await models.source.list();
            data.usages = await models.usage.list();
            data.statuses = await models.status.list();
            data.types = await models.type.list();
        }
        return async.mapSeries(result.rows, async(row) => {
            return fill(row, data);
        });
    }
};

exports.findOne = async function (campaignId, conditions){
    const result = await exports.find(campaignId, conditions);
    if (!result.length){ return null; }
    return fill(result[0]);
};


exports.list = async function(campaignId){
    return exports.find(campaignId, {});
};

exports.search = async function search(conditions){
    const queryParts = [];
    const queryData = [];

    for (const field of ['campaign_id', 'usage_id', 'source_id', 'type_id', 'status_id'] ){
        if (_.has(conditions, field)){
            queryParts.push(field + ' = $' + (queryParts.length+1));
            queryData.push(conditions[field]);
        }
    }

    if (_.has(conditions, 'search')){
        queryParts.push(`UPPER(name) like UPPER($${queryParts.length+1})`);
        queryData.push(`%${conditions.search}%`);
    }
    let query = 'select skills.*, array_agg(tag_id) tags from skills left join skill_tags_xref on skills.id = skill_tags_xref.skill_id';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' group by skills.id';
    query += ' order by name';
    const result = await database.query(query, queryData);
    const data = {
        tags: await models.tag.list()
    };
    if (result.rows.length > 5){
        data.sources = await models.source.list();
        data.usages = await models.usage.list();
        data.statuses = await models.status.list();
        data.types = await models.type.list();
    }
    return async.mapSeries(result.rows, async(row) => {
        return fill(row, data);
    });
};

exports.create = async function(data, cb){
    if (! validate(data)){
        throw new Error('Invalid Data');
    }
    if (!_.has(data, 'campaign_id')){
        throw new Error('Campaign Id must be specified');
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

    let query = 'insert into skills (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    const id = result.rows[0].id;
    if (_.has(data, 'tags')){
        await saveTags(id, data.tags);
    }
    return result.rows[0].id;
};

exports.update = async function(id, data, cb){
    if (! validate(data)){
        throw new Error('Invalid Data');
    }
    const queryUpdates = [];
    const queryData = [id];
    if (!_.has(data, 'updated')){
        data.updated = new Date();
    }
    for (const field of tableFields){
        if (field === 'campaign_id'){
            continue;
        }
        if (_.has(data, field)){
            queryUpdates.push(field + ' = $' + (queryUpdates.length+2));
            queryData.push(data[field]);
        }
    }

    let query = 'update skills set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    if (_.has(data, 'tags')){
        await saveTags(id, data.tags);
    }

    await database.query(query, queryData);
    await cache.invalidate('skill', id);
};

exports.delete = async  function(id, cb){
    const query = 'delete from skills where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('skill', id);
};

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}

async function fill(record, data){
    if (!data){
        data = {};
    }
    if (record.source_id){
        if (data.sources){
            record.source = _.findWhere(data.sources, {id: record.source_id});
        } else {
            record.source = await models.source.get(record.source_id);
        }
    } else {
        record.source = null;
    }

    if (record.usage_id){
        if (data.usages){
            record.usage = _.findWhere(data.usages, {id: record.usage_id});
        } else {
            record.usage = await models.usage.get(record.usage_id);
        }
    } else {
        record.usage = null;
    }

    if (record.type_id){
        if (data.types){
            record.type = _.findWhere(data.types, {id: record.type_id});
        } else {
            record.type = await models.type.get(record.type_id);
        }
    } else {
        record.type = null;
    }

    if (record.status_id){
        if (data.statuses){
            record.status = _.findWhere(data.statuses, {id: record.status_id});
        } else {
            record.status = await models.status.get(record.status_id);
        }
    } else {
        record.status = null;
    }
    if (record.tags){
        if (!data.tags){
            data.tags = await models.tag.list();
        }
        record.tags = record.tags.map(skill_tag => {
            return _.findWhere(data.tags, {'id': skill_tag});
        }).filter(tag => {
            return tag;
        });

        record.tags = _.sortBy(record.tags, 'name');
    }

    return record;
}

async function saveTags(skill_id, tags){

    const currentQuery  = 'select * from skill_tags_xref where skill_id = $1';
    const insertQuery = 'insert into skill_tags_xref (skill_id, tag_id) values ($1, $2)';
    const deleteQuery = 'delete from skill_tags_xref where skill_id = $1 and tag_id = $2';
    const current = await database.query(currentQuery, [skill_id]);

    const newTags = [];
    for (const tag of tags){
        if (_.isObject(tag)){
            newTags.push(Number(tag.id));
        } else {
            newTags.push(Number(tag));
        }
    }

    for (const tag_id of newTags){
        if(!_.findWhere(current.rows, {tag_id: tag_id})){
            await database.query(insertQuery, [skill_id, tag_id]);
        }
    }

    for (const row of current.rows){
        if(_.indexOf(newTags, row.tag_id) === -1){
            await database.query(deleteQuery, [skill_id, row.tag_id]);
        }
    }
}
