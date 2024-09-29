const campaignHelper = require('../../lib/campaignHelper');
const database = require('../../lib/database');
(async function main() {
    await campaignHelper.init(3, {
        skip: {
            glossary:true,
            attributes: true,
        },
        update: true,
        onlyTables: ['skill_tag']
    });
    console.log('done');
    database.end();
})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});
