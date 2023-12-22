#!/app/.heroku/node/bin/node
'use strict';
const mapHelper = require('../lib/mapHelper');
const models = require('../lib/models');

(async function main() {
    const maps = await models.map.find({status:'new'});
    for (const map of maps){
        const campaign = await models.campaign.get(map.campaign_id);
        console.log(`Working on ${map.name} for ${campaign.name}`);
        await mapHelper.clean(map.id);
        console.log('Building map');
        await mapHelper.build(map.id);
    }
    console.log('done');
    process.exit(0);
})().catch((error) => {
    console.trace(error);
    process.exit(1);
});
