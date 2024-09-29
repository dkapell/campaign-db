'use strict';

const async = require('async');
const _ = require('underscore');
const config = require('config');
const pluralize = require('pluralize');
const models = require('../../lib/models');
const database = require('../../lib/database');

const targetCampaign = 2;


(async function main() {
    const skills = await models.skill.find({campaign_id:targetCampaign});
    for (const skill of skills){
        if (!_.findWhere(skill.tags, {name:'required'})){
            continue;
        }

        const doc = {
            name: skill.name,
            required: true
        };
        console.log(doc);

        await models.skill.update(skill.id, doc);
    }
    console.log('done');
    process.exit(0);
})().catch((error) => {
    console.trace(error);
    process.exit(1);
});


