'use strict';

const async = require('async');
const _ = require('underscore');
const database = require('./database');
const validator = require('validator');
const cache = require('./cache');

class Model {

    constructor(table, fields, options){
        this.table = table;
        this.fields = fields;
        this.options = options;
        if (!options.skipAuditFields){
            options.skipAuditFields = [];
        }
    }

    async get(id, options = {}){
        const self = this;
        if (_.indexOf(self.fields, 'id') === -1){
            return;
        }
        let record = await cache.check(self.table, id);
        if (record){
            if (_.has(options, 'postSelect') && _.isFunction(options.postSelect)){
                record = await options.postSelect(record);

            } else if (_.has(self.options, 'postSelect') && _.isFunction(self.options.postSelect)){
                record = await self.options.postSelect(record);
            }
            return record;
        }
        let query = 'select ';
        if (_.has(options, 'excludeFields') && _.isArray(options.excludeFields)) {
            const fields = self.fields.filter(field => {
                if (_.indexOf(options.excludeFields, field) !== -1){
                    return false;
                }
                return true;
            });
            query += fields.join(', ');
        } else {
            query += '*';
        }

        query += ` from ${self.table} where id = $1`;

        try{
            const result = await database.query(query, [id]);

            await cache.store(self.table, id, record);

            if (result.rows.length){
                record = result.rows[0];
                if (_.has(options, 'postSelect') && _.isFunction(options.postSelect)){
                    record = await options.postSelect(record);

                } else if (_.has(self.options, 'postSelect') && _.isFunction(self.options.postSelect)){
                    record = await self.options.postSelect(record);
                }

                await cache.store(self.table, id, record);
                return record;
            }
            return;
        } catch (e){
            console.error(`Get Error: ${self.table}:${id}`);
            throw e;
        }
    }

    async find(conditions = {}, options = {}){
        const self = this;
        const queryParts = [];
        const queryData = [];
        for (const field of self.fields){
            if (_.has(conditions, field)){
                queryParts.push(field + ' = $' + (queryParts.length+1));
                queryData.push(conditions[field]);
            }
        }
        let query = 'select ';
        if (_.has(options, 'count') && options.count){
            query += 'count(*)';

        } else if (_.has(options, 'excludeFields') && _.isArray(options.excludeFields)) {
            const fields = self.fields.filter(field => {
                if (_.indexOf(options.excludeFields, field) !== -1){
                    return false;
                }
                return true;
            });
            query += fields.join(', ');
        } else {
            query += '*';
        }

        query += ` from ${self.table}`;

        if (queryParts.length){
            query += ' where ' + queryParts.join(' and ');
        }
        if (!_.has(options, 'count')){
            if (_.has(options, 'order') && _.isArray(options.order)){
                query += ` order by ${options.order.join(', ')}`;

            } else if (_.has(self.options, 'order') && _.isArray(self.options.order)){
                query += ` order by ${self.options.order.join(', ')}`;
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
            if (_.has(self.options, 'sorter') && _.isFunction(self.options.sorter)){
                rows = result.rows.sort(self.options.sorter);
            }

            if (_.has(options, 'postSelect') && _.isFunction(options.postSelect)){
                return async.map(rows, options.postSelect);

            } else if (_.has(self.options, 'postSelect') && _.isFunction(self.options.postSelect)){
                return async.map(rows, self.options.postSelect);

            } else {
                return rows;
            }

        } catch (e){
            console.error(`Find Error: ${self.table}:${JSON.stringify(conditions)}`);
            throw e;
        }
    }

    async findOne(conditions, options = {}){
        const self = this;
        options.limit = 1;
        const results = await self.find(conditions, options);
        if (results.length){
            return results[0];
        }
        return;
    }

    async count(conditions, options={}){
        const self = this;
        options.count = true;
        const results = await self.find(conditions, options);
        return results[0].count ? results[0].count: 0;
    }

    async list(){
        const self = this;
        return self.find({});
    }

    async create(data){
        const self = this;
        if (_.has(self.options.validator) && _.isFunction(self.options.validator) && ! self.options.validator(data)){
            throw new Error('Invalid Data');
        }
        if (_.indexOf(self.fields, 'campaign_id') !== -1){
            // Require campaign_id on row creation
            if (!_.has(data, 'campaign_id')){
                throw new Error('Campaign Id must be specified');
            }
        }

        const queryFields = [];
        const queryData = [];
        const queryValues = [];
        for (const field of self.fields){
            if (field === 'id'){
                continue;
            }
            if (_.has(data, field)){
                queryFields.push(field);
                queryValues.push('$' + queryFields.length);
                queryData.push(data[field]);
            }
        }

        let query = `insert into ${self.table} (`;
        query += queryFields.join (', ');
        query += ') values (';
        query += queryValues.join (', ');

        if (_.indexOf(self.fields, 'id') !== -1){
            query += ') returning id';
        } else {
            query += ')';
        }
        try{
            const result = await database.query(query, queryData);
            if (_.indexOf(self.fields, 'id') !== -1){
                const id = result.rows[0].id;
                if (_.has(self.options, 'postSave') && _.isFunction(self.options.postSave)){
                    await self.options.postSave(id, data);
                }

                return id;
            } else {
                return;
            }
        } catch (e){
            console.error(`Create Error: ${self.table}: ${JSON.stringify(data)}`);
            console.trace(e);
            throw e;
        }
    }

    async update(id, data){
        const self = this;
        if (_.has(self.options.validator) && _.isFunction(self.options.validator) && ! self.options.validator(data)){
            throw new Error('Invalid Data');
        }

        const queryUpdates = [];
        const queryData = [];
        const whereUpdates = [];
        if (_.indexOf(self.fields, 'id') !== -1){
            queryData.push(id);
            whereUpdates.push('id = $1');
        } else {
            for (const field of self.options.keyFields){
                if(!_.has(id, field)){
                    throw new Error('missing key field:' + field);
                }
                whereUpdates.push(field + ' = $' + (whereUpdates.length+1));
                queryData.push(id[field]);
            }
        }

        for (const field of self.fields){

            // never update campaign_id once set
            if (field === 'campaign_id'){
                continue;
            }
            if (field === 'id'){
                continue;
            }
            // do not update key fields
            if (_.indexOf(self.options.keyFields, field) !== -1){
                continue;
            }

            if (_.has(data, field)){
                queryUpdates.push(field + ' = $' + (whereUpdates.length + queryUpdates.length+1));
                queryData.push(data[field]);
            }
        }


        let query = `update ${self.table} set `;
        query += queryUpdates.join(', ');
        query += ` where ${whereUpdates.join(' and ')};`;
        try {
            await database.query(query, queryData);

            if (_.has(self.options, 'postSave') && _.isFunction(self.options.postSave)){
                await self.options.postSave(id, data);
            }

            await cache.invalidate(self.table, id);
        } catch (e){
            console.error(`Update Error: ${self.table}: ${id}: ${JSON.stringify(data)}`);
            throw e;
        }
    }

    async delete(conditions){
        const self = this;
        let data = null;
        let query = `delete from ${self.table} where `;
        const queryData = [];

        if (_.isObject(conditions)){
            if (_.has(self.options, 'postDelete') && _.isFunction(self.options.postDelete)){
                data = await self.findOne(conditions);
                if (!data) { return; }
            }
            const queryParts = [];
            for (const field of self.fields){
                if (_.has(conditions, field)){
                    queryParts.push(field + ' = $' + (queryParts.length+1));
                    queryData.push(conditions[field]);
                }
            }
            query += queryParts.join(' and ');

        } else {
            const id = conditions;

            if (_.has(self.options, 'postDelete') && _.isFunction(self.options.postDelete)){
                data = await self.get(id);
                if (!data) { return; }
            }
            query += 'id = $1';
            queryData.push(id);
        }
        try{
            await database.query(query, queryData);
            if (_.has(data, 'id')){
                await cache.invalidate(self.table, data.id);
            }

            if (_.has(self.options, 'postDelete') && _.isFunction(self.options.postDelete)){
                await self.options.postDelete(conditions, data);
            }
        } catch (e){
            console.error(`Delete Error: ${self.table}: ${conditions}`);
            throw e;
        }
    }

}

module.exports = Model;

