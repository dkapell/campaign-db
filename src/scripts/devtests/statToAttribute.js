'use strict';

const async = require('async');
const _ = require('underscore');
const config = require('config');
const pluralize = require('pluralize');
const models = require('../../lib/models');
const database = require('../../lib/database');

const targetCampaign = 3;



(async function main() {
    const skills = await models.skill.find({campaign_id:targetCampaign});
    for (const skill of skills){
        if (!skill.provides.length){
            continue;
        }
        let changed = false;
        for (const provides of skill.provides){
            if (provides.type === 'stat'){
                provides.type = 'attribute';
                changed = true;
            }
        }
        if (!changed) {
            continue;
        }
        console.log(skill.provides);
        const doc = {
            name: skill.name,
            provides: JSON.stringify(skill.provides)
        };
        await models.skill.update(skill.id, doc);
    }
    console.log('done');
    process.exit(0);
})().catch((error) => {
    console.trace(error);
    process.exit(1);
});


