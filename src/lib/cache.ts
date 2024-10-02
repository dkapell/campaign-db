'use strict';
import {createClient, RedisClientOptions, RedisClientType } from 'redis';
import crypto from 'crypto';
import config from 'config';

const defaultTimeout = 60;

interface MemoryCacheRecord{
    expires: number,
    data: Record<string, unknown>
}

class Cache{
    private static _instance:Cache;
    memCache: Map<string, Map<string|number,unknown >>;
    type: 'redis'|'local';
    client:RedisClientType;

    constructor(){
        if(Cache._instance){
            throw new Error('Singleton classes can\'t be instantiated more than once.');
        }
        Cache._instance = this;
        this.memCache = new Map();

        if (config.get('app.cacheType') === 'redis'){
            this.type = 'redis';
            this.client = getClient();
            this.client.on('error', function(error){
                console.error(error);
            });

        } else {
            this.type = 'local';
        }
    }

    async store(name:string, id:number|string, data:unknown, timeout?:number){
        //console.trace(`storing ${name}-${id}`)
        id = id.toString();
        const expires = new Date();
        if(!name || !id || !data) { return; }
        timeout = timeout?timeout:defaultTimeout;
        expires.setSeconds(expires.getSeconds() + timeout);

        if (this.type === 'local'){
            if (!this.memCache.has(name)){
                this.memCache.set(name, new Map());
            }
            const subCache = this.memCache.get(name);
            subCache.set(''+id, {
                data: JSON.parse(JSON.stringify(data)),
                expires: expires.getTime(),
            });
        } else {
            const cacheId = getHash(name, id);
            await this.client.set(cacheId, JSON.stringify(data));
            return this.client.expire(cacheId, timeout);
        }
    }

    async check(name:string, id:number|string){
        if (!id) { return; }
        id = id.toString();
        if (this.type === 'local'){
            if (this.memCache.has(name)){
                const subCache = this.memCache.get(name);
                if (subCache.has(''+id)){
                    const record = subCache.get(id);
                    if ((record as MemoryCacheRecord).expires > (new Date()).getTime()){
                        return JSON.parse(JSON.stringify((record as MemoryCacheRecord).data));
                    }
                }
            }
            return null;
        } else {
            try{
                const cacheId = getHash(name, id);
                const result = await this.client.get(cacheId);
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

    async invalidate(name:string, id?:number|string){
        //console.trace(`invalidate ${name}-${id}`)
        id = id.toString();
        if (this.type === 'local'){
            if (this.memCache.has(name)){
                if (id){
                    const subCache = this.memCache.get(name);
                    if (subCache.has(id)){
                        subCache.delete(id);
                    }
                } else {
                    this.memCache.delete(name);
                }
            }
        } else {
            if (id){
                const cacheId = getHash(name, id);
                return this.client.del(cacheId);
            }
        }
    }
}

function getClient(){
    let redisClient = null;
    if (config.get('app.redis.url')){
        const options = {
            url: config.get('app.redis.url'),
            tls: null
        };
        if (config.get('app.redis.tls')){
            options.tls = {rejectUnauthorized: false};
        }
        redisClient = createClient(options as RedisClientOptions);

    } else {
        redisClient = createClient();
    }
    redisClient.on('connect', function() {
        console.log('Using redis for cache');
    });
    redisClient.on('error', err => {
        console.log('Error ' + err);
    });

    (async() => {
        await redisClient.connect().catch(console.error);
    })();

    return redisClient;
}

function getHash(name:string, id:string){
    return crypto.createHash('sha1').update(`cache-${name}-id-${id}`).digest('base64');
}

export = new Cache();
