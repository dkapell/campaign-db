'use strict';
import async from 'async';
import _ from 'underscore';
import database from '../lib/database';
import cache from '../lib/cache';
import validator from 'validator';

import skill_sourceModel from './skill_source';
import skill_usageModel from './skill_usage';
import skill_tagModel from './skill_tag';
import skill_statusModel from './skill_status';

const models = {
    source: skill_sourceModel,
    usage: skill_usageModel,
    tag: skill_tagModel,
    status: skill_statusModel
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
    'status_id',
    'provides',
    'requires',
    'require_num',
    'conflicts',
    'updated',
    'required'
];

async function get(id:number): Promise<SkillModel>{
    let skill = await cache.check('skill', id);
    if (skill){ return fill(skill as SkillModel); }
    const query = 'select skills.*, array_agg(tag_id) tags from skills left join skill_tags_xref on skills.id = skill_tags_xref.skill_id where id = $1 group by skills.id';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        skill = result.rows[0];
        await cache.store('skill', id, skill);
        const allTags = await models.tag.find({campaign_id:skill.campaign_id});
        return fill(skill, allTags);
    }
    return;
}

async function find(conditions:Conditions, options?:RequestOptions): Promise<SkillModel[]>{
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
    query += ' order by name';

    const result = await database.query(query, queryData);
    if (options && _.has(options, 'skipRelations') && options.skipRelations){
        return result.rows;
    } else {
        const data = {
            tags: await models.tag.list(),
            sources: [],
            usages:[],
            statuses:[]
        };
        if (result.rows.length > 5){
            data.sources = await models.source.list();
            data.usages = await models.usage.list();
            data.statuses = await models.status.list();
        }
        return async.mapSeries(result.rows, async(row) => {
            return fill(row, data);
        });
    }
}

async function findOne(conditions:Conditions): Promise<SkillModel>{
    const result:SkillModel[] = await find(conditions);
    if (!result.length){ return null; }
    return fill(result[0]);
}


async function list(campaignId:number): Promise<SkillModel[]> {
    return find({campaign_id: campaignId});
}

async function search(conditions:Conditions): Promise<SkillModel[]>{
    const queryParts = [];
    const queryData = [];

    for (const field of ['campaign_id', 'usage_id', 'source_id', 'status_id'] ){
        if (_.has(conditions, field)){
            queryParts.push(field + ' = $' + (queryParts.length+1));
            queryData.push(conditions[field]);
        }
    }

    if (_.has(conditions, 'search')){
        queryParts.push(`UPPER(name) like UPPER($${queryParts.length+1})`);
        queryData.push(`%${conditions.search}%`);
    }

    if (_.has(conditions, 'tag_id')){
        queryParts.push(`skill_tags_xref.tag_id = $${queryParts.length+1}`);
        queryData.push(conditions.tag_id);
    }

    let query = 'select skills.*, array_agg(tag_id) tags from skills left join skill_tags_xref on skills.id = skill_tags_xref.skill_id';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' group by skills.id';
    query += ' order by name';

    const result = await database.query(query, queryData);
    const data = {
        tags: await models.tag.list(),
        sources: [],
        usages:[],
        statuses:[]
    };

    if (result.rows.length > 5){
        data.sources = await models.source.list();
        data.usages = await models.usage.list();
        data.statuses = await models.status.list();
    }
    return async.mapSeries(result.rows, async(row) => {
        return fill(row, data);
    });
}

async function create(data:ModelData): Promise<number> {
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
}

async function update(id:number, data:ModelData):Promise<void>{
    if (! validate(data)){
        throw new Error('Invalid Data');
    }
    const queryUpdates = [];
    const queryData = [];
    queryData.push(id);
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
}

async function remove(id): Promise<void>{
    const query = 'delete from skills where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('skill', id);
}



function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

async function fill(record:SkillModel, data?){
    if (!data){
        data = {};
    }
    if (record.source_id){
        if (data.sources && data.sources.length){
            record.source = _.findWhere(data.sources, {id: record.source_id});
        } else {
            record.source = await models.source.get(record.source_id);
        }
    } else {
        record.source = null;
    }

    if (record.usage_id){
        if (data.usages && data.usages.length){
            record.usage = _.findWhere(data.usages, {id: record.usage_id});
        } else {
            record.usage = await models.usage.get(record.usage_id);
        }
    } else {
        record.usage = null;
    }

    if (record.status_id){
        if (data.statuses && data.statuses.length){
            record.status = _.findWhere(data.statuses, {id: record.status_id});
        } else {
            record.status = await models.status.get(record.status_id);
        }
    } else {
        record.status = null;
    }
    if (record.tags){
        if (!data.tags){
            data.tags = await models.tag.find({campaign_id:data.campaign_id});
        }
        record.tags = record.tags.map(skill_tag => {
            return _.findWhere(data.tags, {'id': skill_tag});
        }).filter(tag => {
            return tag;
        });
        record.tags = record.tags.sort((a, b) => {
            if (a.type === 'category'){
                if (b.type === 'category'){
                    return a.type.localeCompare(b.type);
                }
                return -1;
            } else if (b.type === 'category'){
                return 1;
            } else if (a.type !== b.type){
                return a.type.localeCompare(b.type);
            } else {
                return a.name.localeCompare(b.name);
            }
        });
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

export = {
    get: get,
    find: find,
    findOne: findOne,
    list: list,
    search: search,
    create: create,
    update: update,
    delete: remove
};
