'use strict';
import validator from 'validator';
import Model from  '../lib/Model';
import cache from '../lib/cache';

const tableFields = ['id', 'campaign_id', 'name'];

interface GlossaryTagModel extends IModel {
   getByName?: (name:string, campaignId: number) => Promise<ModelData>
}

const GlossaryTag:GlossaryTagModel = new Model('glossary_tags', tableFields, {
    order: ['name'],
    validator: validate
});

GlossaryTag.getByName = async function getByName(name, campaignId){
    let glossary_tag = await cache.check('glossary_tag-name',   `${campaignId}-${name}`);
    if (glossary_tag){ return glossary_tag; }
    glossary_tag = await this.findOne({name:name, campaign_id:campaignId});
    if (glossary_tag){
        await cache.store('glossary_tag-name', `${campaignId}-${name}`, glossary_tag);
        return glossary_tag;
    } else {
        const id = await this.create({name:name, campaign_id:campaignId});
        return this.get(id);
    }
};

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

export = GlossaryTag;
