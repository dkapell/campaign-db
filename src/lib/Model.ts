'use strict';

import async from 'async';
import _ from 'underscore';
import database from './database';
import cache from './cache';


interface ModelOptions {
    skipAuditFields?: string[]
    postSelect?: (data:ModelData) => Promise<ModelData>,
    postSave?: (id:number, data:ModelData) => Promise<void>,
    postDelete?: (condition: ComplexId, data:ModelData) => Promise<void>,
    validator?: (data: ModelData) => boolean,
    order?: string[],
    sorter?: (a:ModelData, b:ModelData)=>number,
    keyFields?: string[]
}


class Model implements IModel{
    table: string;
    fields: string[];
    options: ModelOptions;

    constructor(table: string, fields: string[], options: ModelOptions){
        this.table = table;
        this.fields = fields;
        this.options = options;
        if (!options.skipAuditFields){
            options.skipAuditFields = [];
        }
    }

    async get(id, options:RequestOptions = {}){
        if (_.indexOf(this.fields, 'id') === -1){
            return;
        }
        let record = await cache.check(this.table, id);
        if (record){
            if (_.has(options, 'postSelect') && _.isFunction(options.postSelect)){
                record = await options.postSelect(record);

            } else if (_.has(this.options, 'postSelect') && _.isFunction(this.options.postSelect)){
                record = await this.options.postSelect(record);
            }
            return record;
        }
        let query = 'select ';
        if (_.has(options, 'excludeFields') && _.isArray(options.excludeFields)) {
            const fields = this.fields.filter(field => {
                if (_.indexOf(options.excludeFields, field) !== -1){
                    return false;
                }
                return true;
            });
            query += fields.join(', ');
        } else {
            query += '*';
        }

        query += ` from ${this.table} where id = $1`;

        try{
            const result = await database.query(query, [id]);

            await cache.store(this.table, id, record);

            if (result.rows.length){
                record = result.rows[0];
                if (_.has(options, 'postSelect') && _.isFunction(options.postSelect)){
                    record = await options.postSelect(record);

                } else if (_.has(this.options, 'postSelect') && _.isFunction(this.options.postSelect)){
                    record = await this.options.postSelect(record);
                }

                await cache.store(this.table, id, record);
                return record;
            }
            return;
        } catch (e){
            console.error(`Get Error: ${this.table}:${id}`);
            throw e;
        }
    }

    async find(conditions:Conditions = {}, options:RequestOptions = {}):Promise<ModelData[]>{
        const queryParts = [];
        const queryData = [];
        for (const field of this.fields){
            if (_.has(conditions, field)){
                queryParts.push(field + ' = $' + (queryParts.length+1));
                queryData.push(conditions[field]);
            }
        }
        let query = 'select ';
        if (_.has(options, 'count') && options.count){
            query += 'count(*)';

        } else if (_.has(options, 'excludeFields') && _.isArray(options.excludeFields)) {
            const fields = this.fields.filter(field => {
                if (_.indexOf(options.excludeFields, field) !== -1){
                    return false;
                }
                return true;
            });
            query += fields.join(', ');
        } else {
            query += '*';
        }

        query += ` from ${this.table}`;

        if (queryParts.length){
            query += ' where ' + queryParts.join(' and ');
        }
        if (!_.has(options, 'count')){
            if (_.has(options, 'order') && _.isArray(options.order)){
                query += ` order by ${options.order.join(', ')}`;

            } else if (_.has(this.options, 'order') && _.isArray(this.options.order)){
                query += ` order by ${this.options.order.join(', ')}`;
            }
        }

        if (_.has(options, 'offset')){
            query += ` offset ${Number(options.offset)}`;
        }

        if (_.has(options, 'limit')){
            query += ` limit ${Number(options.limit)}`;
        }

        try {
            const result = await database.query(query, queryData);

            if (_.has(options, 'count')){
                return result.rows;
            }
            let rows = result.rows;
            if (_.has(this.options, 'sorter') && _.isFunction(this.options.sorter)){
                rows = result.rows.sort(this.options.sorter);
            }

            if (_.has(options, 'postSelect') && _.isFunction(options.postSelect)){
                return async.map(rows, options.postSelect);

            } else if (_.has(this.options, 'postSelect') && _.isFunction(this.options.postSelect)){
                return async.map(rows, this.options.postSelect);

            } else {
                return rows;
            }

        } catch (e){
            console.error(`Find Error: ${this.table}:${JSON.stringify(conditions)}`);
            throw e;
        }
    }

    async findOne(conditions:Conditions, options:RequestOptions = {}){
        options.limit = 1;
        const results = await this.find(conditions, options);
        if (results.length){
            return results[0];
        }
        return;
    }

    async count(conditions:Conditions, options:RequestOptions={}):Promise<number>{
        options.count = true;
        const results = await this.find(conditions, options);
        return results[0].count ? (results[0].count as number): 0;
    }

    async list(){
        return this.find({});
    }

    async create(data: ModelData){
        if (_.has(this.options, 'validator') && _.isFunction(this.options.validator) && ! this.options.validator(data)){
            throw new Error('Invalid Data');
        }
        if (_.indexOf(this.fields, 'campaign_id') !== -1){
            // Require campaign_id on row creation
            if (!_.has(data, 'campaign_id')){
                throw new Error('Campaign Id must be specified');
            }
        }

        const queryFields = [];
        const queryData = [];
        const queryValues = [];
        for (const field of this.fields){
            if (field === 'id'){
                continue;
            }
            if (_.has(data, field)){
                queryFields.push(field);
                queryValues.push('$' + queryFields.length);
                queryData.push(data[field]);
            }
        }

        let query = `insert into ${this.table} (`;
        query += queryFields.join (', ');
        query += ') values (';
        query += queryValues.join (', ');

        if (_.indexOf(this.fields, 'id') !== -1){
            query += ') returning id';
        } else {
            query += ')';
        }
        try{
            const result = await database.query(query, queryData);
            if (_.indexOf(this.fields, 'id') !== -1){
                const id = result.rows[0].id;
                if (_.has(this.options, 'postSave') && _.isFunction(this.options.postSave)){
                    await this.options.postSave(id, data);
                }

                return id;
            } else {
                return;
            }
        } catch (e){
            console.error(`Create Error: ${this.table}: ${JSON.stringify(data)}`);
            console.trace(e);
            throw e;
        }
    }

    async update(id:ComplexId, data: ModelData){
        if (_.has(this.options, 'validator') && _.isFunction(this.options.validator) && ! this.options.validator(data)){
            throw new Error('Invalid Data');
        }

        const queryUpdates = [];
        const queryData = [];
        const whereUpdates = [];
        if (_.indexOf(this.fields, 'id') !== -1){
            queryData.push(id);
            whereUpdates.push('id = $1');
        } else {
            for (const field of this.options.keyFields){
                if(!_.has(id, field)){
                    throw new Error('missing key field:' + field);
                }
                whereUpdates.push(field + ' = $' + (whereUpdates.length+1));
                queryData.push(id[field]);
            }
        }

        for (const field of this.fields){

            // never update campaign_id once set
            if (field === 'campaign_id'){
                continue;
            }
            if (field === 'id'){
                continue;
            }
            // do not update key fields
            if (_.indexOf(this.options.keyFields, field) !== -1){
                continue;
            }

            if (_.has(data, field)){
                queryUpdates.push(field + ' = $' + (whereUpdates.length + queryUpdates.length+1));
                queryData.push(data[field]);
            }
        }


        let query = `update ${this.table} set `;
        query += queryUpdates.join(', ');
        query += ` where ${whereUpdates.join(' and ')};`;
        try {
            await database.query(query, queryData);

            if (typeof id === 'number' || typeof id === 'string'){
                id = Number(id);
            }

            if (typeof id === 'number' && _.has(this.options, 'postSave') && _.isFunction(this.options.postSave)){
                await this.options.postSave(id, data);
            }
            if (typeof id === 'number'){
                await cache.invalidate(this.table, id);
            }
        } catch (e){
            console.error(`Update Error: ${this.table}: ${id}: ${JSON.stringify(data)}`);
            throw e;
        }
    }

    async delete(conditions: ComplexId){
        let data = null;
        let query = `delete from ${this.table} where `;
        const queryData = [];

        if (_.isObject(conditions)){
            if (_.has(this.options, 'postDelete') && _.isFunction(this.options.postDelete)){
                data = await this.findOne(conditions);
                if (!data) { return; }
            }
            const queryParts = [];
            for (const field of this.fields){
                if (_.has(conditions, field)){
                    queryParts.push(field + ' = $' + (queryParts.length+1));
                    queryData.push(conditions[field]);
                }
            }
            query += queryParts.join(' and ');

        } else {
            const id = conditions;

            if (_.has(this.options, 'postDelete') && _.isFunction(this.options.postDelete)){
                data = await this.get(id);
                if (!data) { return; }
            }
            query += 'id = $1';
            queryData.push(id);
        }
        try{
            await database.query(query, queryData);
            if (_.has(data, 'id')){
                await cache.invalidate(this.table, data.id);
            }

            if (_.has(this.options, 'postDelete') && _.isFunction(this.options.postDelete)){
                await this.options.postDelete(conditions, data);
            }
        } catch (e){
            console.error(`Delete Error: ${this.table}: ${conditions}`);
            throw e;
        }
    }

}
export default Model;
