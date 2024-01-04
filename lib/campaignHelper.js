'use strict';

const _ = require('underscore');
const config = require('config');
const models = require('./models');
const fs = require('fs/promises');

exports.init = async function init(campaignId){
    const data = JSON.parse(await fs.readFile(__dirname + '/../data/campaignDefaults.json'));
    await createGlossaryEntries(campaignId, data.glossary);
    await createAttributes(campaignId, data.attributes);
    await createSkillEntries(campaignId, data.skills);
};

async function createGlossaryEntries(campaignId, glossaryEntries){
    for (const table in glossaryEntries){
        for (const doc of glossaryEntries[table]){

            await createRow(campaignId, table, doc);

        }
    }
}

async function createAttributes(campaignId, attributes){
    for (const doc of attributes){
        await createRow(campaignId, 'attribute', doc);
    }
}

async function createSkillEntries(campaignId, skillEntries){
    for (const table in skillEntries){
        for (const doc of skillEntries[table]){
            await createRow(campaignId, table, doc);

        }
    }
    const openSkillSourceType = await models.skill_source_type.findOne({campaign_id:campaignId, name:'open'});
    if (!openSkillSourceType){
        throw new Error ('Could not find open skill source type');
    }
    const doc = {
        name: 'Open Skills',
        type_id: openSkillSourceType.id,
        campaign_id: campaignId
    };
    const existing = await models.skill_source.findOne(doc);
    if (existing) { return; }
    return models.skill_source.create(doc);
}

async function createRow(campaignId, table, data){
    const doc = {
        campaign_id: campaignId,
        name: data.name
    };

    const existing = await models[table].findOne(doc);
    if (existing) { return; }
    const row = _.clone(data);
    row.campaign_id = campaignId;
    return models[table].create(row);
}

exports.attributeSorter = async function attributeSorter(attributes, campaignId){
    const attributeList = await models.attribute.find({campaign_id:campaignId});
    return attributes.sort((a, b) => {
        const attrA = _.findWhere(attributeList, {name:a.name});
        const attrB = _.findWhere(attributeList, {name:b.name});
        if (a.internal) {
            if(b.internal){
                return 0;
            } else {
                return 1;
            }
        } else if (b.internal){
            return -1;
        } else if (attrA){
            if (attrB){
                return attrA.display_order - attrB.display_order;
            } else {
                return -1;
            }
        } else if (attrB){
            return 1;
        } else {
            return a.name.localeCompare(b.name);
        }
    });

};
