'use strict';

const _ = require('underscore');
const config = require('config');
const models = require('./models');
const fs = require('fs/promises');

exports.init = async function init(campaignId, options){
    if (!options){
        options = {};
    }
    const data = JSON.parse(await fs.readFile(__dirname + '/../data/campaignDefaults.json'));
    await createGlossaryEntries(campaignId, data.glossary, options);
    await createAttributes(campaignId, data.attributes, options);
    await createSkillEntries(campaignId, data.skills, options);
};

async function createGlossaryEntries(campaignId, glossaryEntries, options){
    if (options.skip && options.skip.glossary){ return; }
    for (const table in glossaryEntries){
        for (const doc of glossaryEntries[table]){

            await createRow(campaignId, table, doc, options);

        }
    }
}

async function createAttributes(campaignId, attributes, options){
    if (options.skip && options.skip.attributes){ return; }
    for (const doc of attributes){
        await createRow(campaignId, 'attribute', doc, options);
    }
}

async function createSkillEntries(campaignId, skillEntries, options){
    if (options.skip && options.skip.skills){ return; }
    for (const table in skillEntries){
        if (!options.onlyTables || _.indexOf(options.onlyTables, table) !== -1){
            for (const doc of skillEntries[table]){
                await createRow(campaignId, table, doc, options);

            }
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

async function createRow(campaignId, table, data, options){
    const doc = {
        campaign_id: campaignId,
        name: data.name
    };

    const existing = await models[table].findOne(doc);
    if (existing) {
        if (!options.update) {
            return;
        }
        for (const field in data){
            existing[field] = data[field];
        }
        return models[table].update(existing.id, existing);

    } else {
        const row = _.clone(data);
        row.campaign_id = campaignId;
        return models[table].create(row);
    }
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

exports.cpCalculator = async function cpCalculator(userId, campaignId){
    const campaign = await models.campaign.get(campaignId);
    const cpGrants = await models.cp_grant.find({user_id:userId, campaign_id:campaignId, approved:true});
    const result = {
        base: 0,
        total: 0,
        usable: 0,
    };

    if (campaign.cp_base){
        result.base = campaign.cp_base;
        result.total = campaign.cp_base;
        result.usable = campaign.cp_base;
    }
    let accrued = 0;
    for (const grant of cpGrants){
        accrued += grant.amount;
    }
    if (!campaign.cp_cap){
        result.total += accrued;
        result.usable += accrued;
        return result;
    }
    const maxAccrued = campaign.cp_cap - result.base;

    if (accrued <= maxAccrued  ){
        result.total += accrued;
        result.usable += accrued;
        return result;
    }
    result.total += accrued;
    result.usable += maxAccrued;

    if (campaign.cp_factor){
        accrued -= maxAccrued;
        result.usable += (accrued * campaign.cp_factor);

    }
    return result;
};
