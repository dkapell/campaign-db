'use strict';

const async = require('async');
const _ = require('underscore');
const pg = require('pg');
const config = require('config');
const parseDbUrl = require('parse-database-url');
const pluralize = require('pluralize');
const models = require('../../lib/models');
const database = require('../../lib/database');

const targetCampaign = 3;

const ritualDbUrl = 'postgres://ritual:8awc9ywryA0gRt8nHdRgY3lzpzuk7ayS@knotaffront.c71kshacy5bi.us-east-1.rds.amazonaws.com/ritual?ssl=true';

const poolConfig = parseDbUrl(ritualDbUrl);
poolConfig.ssl = {
    rejectUnauthorized: false
};
const pool = new pg.Pool(poolConfig);

pool.on('error', function (err, client) {
    console.error('idle client error', err.message, err.stack);
});

async function ritualQuery(query, data){
    const result = await pool.query(query, data);
    return result.rows;
}


const tables = [
    /*{
        name: 'user',
        table: 'users',
        type: 'user',
    },
    {
        name: 'glossary_tag',
        table: 'glossary_tags'
    },
    {
        name: 'glossary_entry',
        table: 'glossary_entries',
        lookups: {
            status_id: {
                type: 'lookup',
                old: 'glossary_statuses',
                new: 'glossary_status'
            }
        }
    },
    {
        table: 'glossary_entry_tag',
        type: 'xref',
        lookups: {
            entry_id: {
                type: 'lookup',
                old: 'glossary_entries',
                new: 'glossary_entry'
            },
            tag_id: {
                type: 'lookup',
                old: 'glossary_tags',
                new: 'glossary_tag'
            }
        }
    },
    {
        name: 'skill_source_type',
        table: 'skill_source_types',
    },
    {
        name: 'skill_type',
        table: 'skill_types',
    },
    {
        name: 'skill_usage',
        table: 'skill_usages',
    },
    {
        name: 'skill_tag',
        table: 'skill_tags',
    },
    {
        name: 'skill_source',
        table: 'skill_sources',
        lookups: {
            type_id: {
                type: 'lookup',
                old: 'skill_source_types',
                new: 'skill_source_type'
            }
        },
        jsonFields: ['provides', 'requires', 'conflicts'],
        postLoad: {
            requires: {
                type: 'id array',
                new: 'skill_source',
                old: 'skill_sources'
            },
            conflicts: {
                type: 'id array',
                new: 'skill_source',
                old: 'skill_sources'
            }
        }

    },*/
    {
        name: 'skill',
        table: 'skills',
        dedup: ['name', 'source_id'],
        lookups: {
            source_id: {
                type: 'lookup',
                old: 'skill_sources',
                new: 'skill_source'
            },
            usage_id: {
                type: 'lookup',
                old: 'skill_usages',
                new: 'skill_usage'
            },
            type_id: {
                type: 'lookup',
                old: 'skill_types',
                new: 'skill_type'
            },
            status_id: {
                type: 'lookup',
                old: 'skill_statuses',
                new: 'skill_status'
            }
        },
        jsonFields: ['provides', 'requires', 'conflicts'],
        postLoad: {
            requires: {
                type: 'id array',
                new: 'skill',
                old: 'skills'
            },
            conflicts: {
                type: 'id array',
                new: 'skill',
                old: 'skills'
            }
        }
    },
    {
        name: 'skill_tags_xref',
        table: 'skill_tags_xref',
        type: 'xref',
        lookups: {
            skill_id: {
                type: 'lookup',
                old: 'skills',
                new: 'skill'
            },
            tag_id: {
                type: 'lookup',
                old: 'skill_tags',
                new: 'skill_tag'
            },
        }
    },
    {
        name: 'skill_review',
        table: 'skill_reviews',
        dedup: ['skill_id', 'user_id', 'created'],
        lookups: {
            user_id: {
                type: 'lookup',
                old: 'users',
                new: 'user'
            },
            skill_id: {
                type: 'lookup',
                old: 'skills',
                new: 'skill'
            },
        }
    },
    {
        name: 'character',
        table: 'characters',
        lookups: {
            user_id: {
                type: 'lookup',
                old: 'users',
                new: 'user'
            },
        },
        skipFields: ['foreordainment']
    },
    {
        name: 'character_skill_source',
        table: 'character_skill_sources',
        type: 'xref',
        lookups: {
            character_id: {
                type: 'lookup',
                old: 'characters',
                new: 'character'
            },
            skill_source_id: {
                type: 'lookup',
                old: 'skill_sources',
                new: 'skill_source'
            },
        }
    },
    {
        name: 'character_skill',
        table: 'character_skills',
        type: 'xref',
        lookups: {
            character_id: {
                type: 'lookup',
                old: 'characters',
                new: 'character'
            },
            skill_id: {
                type: 'lookup',
                old: 'skills',
                new: 'skill'
            },
        }
    },
    /*
    {
        name: 'audit',
        table: 'audits',
        dedup: ['user_id', 'created'],
        skipRows: {
            object_type: ['deck', 'card', 'detriment' ]
        },
        lookups: {
            user_id: {
                type: 'lookup',
                old: 'users',
                new: 'user'
            },
            object_id: {
                type: 'object id'
            }
        },
        postLoad: {
            data: {
                type: 'audit'
            }
        }

    }*/

];


(async function main() {
    for (const tableConfig of tables){
        console.log(`working on ${tableConfig.table}`);
        await processTable(tableConfig);
    }
    console.log('done');
    process.exit(0);
})().catch((error) => {
    console.trace(error);
    process.exit(1);
});


async function getData(table){
    return ritualQuery(`select * from "${table}"`, []);
}
async function getItem(table, id){
    const query = `select * from "${table}" where id = $1 limit 1`;
    const result = await ritualQuery(query, [id]);
    return result[0];
}

async function processTable(tableConfig){
    const data = await getData(tableConfig.table);
    if (tableConfig.type === 'user'){
        for (const user of data){
            delete user.id;
            user.type = user.user_type;
            await models.user.findOrCreate(targetCampaign, user);
        }
    } else if (tableConfig.type === 'xref') {
        return insertXref(tableConfig, data);
    } else {
        const insertedIds = [];

        for (let datum of data){
            delete data.id;
            if (tableConfig.skipRows){
                let skip = false;
                for (const field in tableConfig.skipRows){
                    if (_.indexOf(tableConfig.skipRows[field], datum[field]) !== -1){
                        console.log('skip ' + datum[field]);
                        skip = true;
                    }
                }
                if (skip) { continue;}
            }
            datum = await lookups(tableConfig.lookups, datum);

            const conditions = {
                campaign_id: targetCampaign
            };

            if (tableConfig.dedup){
                for (const field of tableConfig.dedup){
                    conditions[field] = datum[field];
                }
            } else {
                conditions.name = datum.name;
            }
            const current = await models[tableConfig.name].findOne(conditions);
            if(current){ continue; }
            datum.campaign_id = targetCampaign;
            datum = fixJsonFields(tableConfig.jsonFields, datum);
            if (tableConfig.skipFields){
                for (const field of tableConfig.skipFields){
                    delete datum[field];
                }
            }
            const id = await models[tableConfig.name].create(datum);
            insertedIds.push(id);
        }

        if (tableConfig.postLoad){
            for (const id of insertedIds){
                let datum = await models[tableConfig.name].get(id);
                datum = await doPostLoad(tableConfig, datum);
                datum = fixJsonFields(tableConfig.jsonFields, datum);
                await models[tableConfig.name].update(id, datum);
            }
        }
    }
}

async function doPostLoad(tableConfig, datum){
    const postLoad = tableConfig.postLoad;
    for (const field in postLoad){
        const data = datum[field];
        if (postLoad[field].type === 'id array'){
            datum[field] = await getIdArray(datum[field], field, tableConfig);
        } /*
        else if (postLoad[field].type === 'audit'){
            datum[field] = await getAuditData(datum, datum[field]);
        }*/
    }
    return datum;
}

async function getIdArray(data, field, tableConfig){
    const postLoad = tableConfig.postLoad;
    return async.map(data, async (id) => {
        let oldData = await getItem(postLoad[field].old, id);
        oldData = await lookups(tableConfig.lookups, oldData);
        const conditions = {
            campaign_id: targetCampaign
        };

        if (tableConfig.dedup){
            for (const field of tableConfig.dedup){
                conditions[field] = oldData[field];
            }
        } else {
            conditions.name = oldData.name;
        }
        const newData = await models[postLoad[field].new].findOne(conditions);
        return newData.id;
    });
}

async function insertXref(tableConfig, data){
    for (let datum of data){
        datum = await lookups(tableConfig.lookups, datum);
        const fields = [];
        const whereParts = [];
        let partCounter = 1;
        for (const field in datum){
            whereParts.push(`"${field}" = $${partCounter}`);
            fields.push(datum[field]);
            partCounter++;
        }
        let query = `select * from "${tableConfig.table}" where ${whereParts.join(' and ')}`;
        const result = await database.query(query, fields);
        if (result.rows.length) { continue; }
        const queryFields = [];
        const queryValues = [];
        const queryData = [];
        for (const field in datum){
            queryFields.push(field);
            queryValues.push('$' + queryFields.length);
            queryData.push(datum[field]);
        }


        query = `insert into ${tableConfig.table} (`;
        query += queryFields.join (', ');
        query += ') values (';
        query += queryValues.join (', ');

        query += ')';
        await database.query(query, queryData);
    }
}

async function lookups(lookupList, datum){
    for (const field in lookupList){
        const lookupConfig = lookupList[field];
        if (lookupConfig.type === 'lookup'){
            if (datum[field]){
                datum[field] = await getLookup(lookupConfig, datum[field]);
            }
        } else if ( lookupConfig.type === 'object id'){
            datum[field] = await getLookup({old: pluralize(datum.object_type), new: datum.object_type}, datum[field]);
        }
    }
    return datum;
}

function fixJsonFields(jsonFields, datum){
    if (jsonFields){
        for (const field of jsonFields){
            datum[field] = JSON.stringify(datum[field]);
        }
    }
    return datum;
}

async function getLookup(table, id){
    const oldData = await getItem(table.old, id);
    if (!oldData) { return;  }
    let newData = null;
    if (table.new === 'user'){
        newData = await models.user.findOne(targetCampaign, {email: oldData.email});
    } else if (table.new === 'skill'){
        newData = await findSkill(id);

    } else {
        newData = await models[table.new].findOne({campaign_id:targetCampaign, name:oldData.name});
    }
    if (!newData) { throw new Error(`new not found: ${table.new}:${oldData.name}`); }
    return newData.id;
}

async function findSkill(oldId){
    const oldSkill = await getItem('skills', oldId);
    const oldSource = await getItem('skill_sources', oldSkill.source_id);
    const newSource = await models.skill_source.findOne({name:oldSource.name, campaign_id:targetCampaign});
    return  models.skill.findOne({campaign_id:targetCampaign, name:oldSkill.name, source_id:newSource.id});
}
