'use strict';
const validator = require('validator');
const Model = require('../lib/Model');
const cache = require('../lib/cache');

const tableFields = ['id', 'campaign_id', 'name'];

const GlossaryTag = new Model('glossary_tags', tableFields, {
    order: ['name'],
    validator: validate
});

GlossaryTag.getByName = async function getByName(name, campaignId){
    const self = this;
    let glossary_tag = await cache.check('glossary_tag-name',   `${campaignId}-${name}`);
    if (glossary_tag){ return glossary_tag; }
    glossary_tag = await self.findOne({name:name, campaign_id:campaignId});
    if (glossary_tag){
        await cache.store('glossary_tag-name', `${campaignId}-${name}`, glossary_tag);
        return glossary_tag;
    } else {
        const id = await self.create({name:name, campaign_id:campaignId});
        return self.get(id);
    }
};

module.exports = GlossaryTag;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
