'use strict';
const _ = require('underscore');
const async = require('async');
const config = require('config');
const parse = require('csv-parse/lib/sync');


const models = require('../lib/models');
const fs = require('fs');

const infile = process.argv[2];


(async function main() {
    const contents = fs.readFileSync(infile);
    const data = parse(contents, {columns:true});

    await async.each(data, addSkill);
    process.exit(0);

})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});



async function addSkill(row){
    const skill = {
        name: row.Name?row.Name:'TBD',
        summary: row['What it does'],
        description: null,
        notes: row.Notes,
    };

    if (row.Source){

        const source = await models.skill_source.find({name:row.Source});
        if (source.length){
            skill.source_id = source[0].id;
        } else {
            throw new Error (`no source found for ${row.Source}`);
        }
    } else {
        console.log(`no source found for ${row['What it does']}` );
        return;
    }

    if (row.Usage){
        let usageName = row.Usage;
        if (usageName === 'Scene'){
            usageName = 'Always';
        }
        const usage = await models.skill_usage.find({name:usageName});
        if (usage.length){
            skill.usage_id = usage[0].id;
        } else {
            throw new Error (`no usage found for ${row.Usage}`);
        }
    }

    if (row['Skill Type']){
        const type = await models.skill_type.find({name:row['Skill Type']});
        if (type.length){
            skill.type_id = type[0].id;
        } else {
            throw new Error (`no type found for ${row['Skill Type']}`);
        }
    }

    skill.cost = '';

    if (row.Cost){
        skill.cost = row.Cost;
    }

    if (row.Multiple){
        if (row.Multiple !== 'n'){
            row.cost += ` ${row.Multiple} times`;
        }
    }

    const result = await models.skill.find({
        summary: skill.summary,
        source_id: skill.source_id
    });
    if (result.length){
        const current = result[0];
        if  ((current.type_id || skill.type_id) && current.type_id !== skill.type_id){
            console.log(`changed: ${skill.summary} from ${current.type_id} to ${skill.type_id}`);
        }
        current.type_id = skill.type_id;

        //return models.skill.update(current.id, current);

    } else {
        //return models.skill.create(skill);
    }
}

