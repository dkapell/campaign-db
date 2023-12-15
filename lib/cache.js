'use strict';
const _ = require('underscore');
const redis = require('redis');
const crypto = require('crypto');
const config = require('config');
const { promisify } = require('util');

const defaultTimeout = 60;

class Cache{
    constructor(){
        if(Cache._instance){
            throw new Error('Singleton classes can\'t be instantiated more than once.');
        }
        Cache._instance = this;
        const self = this;
        this.memCache = {};

        if (config.get('app.cacheType') === 'redis'){
            this.type = 'redis';
            const client = getClient();
            client.on('error', function(error){
                console.error(error);
            });
            this.client = {
                set: promisify(client.set).bind(client),
                get: promisify(client.get).bind(client),
                del: promisify(client.del).bind(client)
            };

        } else {
            this.type = 'local';
        }
    }

    async store(name, id, data, timeout){
        //console.trace(`storing ${name}-${id}`)
        const self = this;
        const expires = new Date();
        if(!name || !id || !data) { return; }
        timeout = timeout?timeout:defaultTimeout;
        expires.setSeconds(expires.getSeconds() + timeout);

        if (self.type === 'local'){
            if (!_.has(self.memCache, name)){
                self.memCache[name] = {};
            }
            self.memCache[name][id.toString()] = {
                data: JSON.parse(JSON.stringify(data)),
                expires: expires.getTime(),
            };
        } else {
            const cacheId = getHash(name, id);
            return self.client.set(cacheId, JSON.stringify(data), 'ex', timeout);
        }
    }

    async check(name, id){
        const self = this;
        if (!id) { return; }
        id = id.toString();
        if (self.type === 'local'){
            if (_.has(self.memCache, name) && _.has(self.memCache[name], id) && self.memCache[name][id].expires > (new Date()).getTime()){
                return JSON.parse(JSON.stringify(self.memCache[name][id].data));
            }
            return null;
        } else {
            try{
                const cacheId = getHash(name, id);
                const result = await self.client.get(cacheId);
                if (result){
                    const data = JSON.parse(result);
                    return data;
                }
                return null;
            } catch (err){
                console.error(err);
                return null;
            }
        }
    }

    async invalidate(name, id){
        //console.trace(`invalidate ${name}-${id}`)
        const self = this;
        if (self.type === 'local'){
            if (_.has(self.memCache, name)){
                if (id){
                    delete self.memCache[name][id];
                } else {
                    delete self.memCache[name];
                }
            }
        } else {
            if (id){
                const cacheId = getHash(name, id);
                return self.client.del(cacheId);
            }
        }
    }
}

function getClient(){
    let redisClient = null;
    if (config.get('app.redis.url')){
        const options = {};
        if (config.get('app.redis.tls')){
            options.tls = {rejectUnauthorized: false};
        }
        redisClient = redis.createClient(config.get('app.redis.url'), options);

    } else {
        redisClient = redis.createClient();
    }
    return redisClient;
}

function getHash(name, id){
    return crypto.createHash('sha1').update(`cache-${name}-id-${id}`).digest('base64');
}

module.exports = new Cache();
