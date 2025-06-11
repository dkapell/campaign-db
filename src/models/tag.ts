'use strict';

import Model from  '../lib/Model';
import cache from '../lib/cache';

const tableFields = [
    'id',
    'campaign_id',
    'type',
    'name'
];

interface TagIModel extends IModel {
   getByName?: (type:string, name:string, campaignId: number) => Promise<TagModel>
}

const Tag: TagIModel = new Model('tags', tableFields, {
    order: ['name']
});

Tag.getByName = async function getByName(type, name, campaignId){
    let tag = await cache.check(`tagCache-${type}-name`,   `${campaignId}-${name}`);
    if (tag){ return tag; }
    tag = await this.findOne({type:type, name:name, campaign_id:campaignId});
    if (tag){
        await cache.store(`tagCache-${type}-name`, `${campaignId}-${name}`, tag);
        return tag;
    } else {
        const id = await this.create({type: type, name:name, campaign_id:campaignId});
        return this.get(id);
    }
};

export = Tag;

