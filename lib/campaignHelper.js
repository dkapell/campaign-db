'use strict';

const _ = require('underscore');
const config = require('config');
const models = require('./models');

exports.init = async function init(campaignId){
    await createGlossaryEntries(campaignId);
    await createSkillEntries(campaignId);
}

async function createGlossaryEntries(campaignId){
    const glossaryEntries = config.get('campaignDefaults.glossary');
    for (const table in glossaryEntries){
        for (const doc of glossaryEntries[table]){

            await createRow(campaignId, table, doc);

        }
    }
}

async function createSkillEntries(campaignId){
    const skillEntries = config.get('campaignDefaults.skills');
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
    }
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
    const row = _.clone(data)
    row.campaign_id = campaignId;
    return models[table].create(row);
}
