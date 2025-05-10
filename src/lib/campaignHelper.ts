'use strict';

import _ from 'underscore';
import models from './models';
import fs from 'fs/promises';
import stringify from 'csv-stringify-as-promised';
import moment from 'moment-timezone';
import surveyHelper from '../lib/surveyHelper';

type SkillTableTypes = 'skill_source_type'|'skill_type'|'skill_usage'|'skill_status'|'skill_tag';
type GlossaryTypes = 'glossary_status';
type GlossaryOptions = {
    [key:string]:unknown|{[key:string]:unknown}|unknown[],
    skip?:{[key:string]:unknown}
    onlyTables?:string[]
}

async function init(campaignId:number, options?:{[key:string]:unknown}): Promise<void>{
    if (!options){
        options = {};
    }
    const data = JSON.parse(await fs.readFile(__dirname + '/../../data/campaignDefaults.json', 'utf8'));
    await createGlossaryEntries(campaignId, data.glossary, options);
    await createAttributes(campaignId, data.attributes, options);
    await createSkillEntries(campaignId, data.skills, options);
};

async function createGlossaryEntries(campaignId:number, glossaryEntries:Record<GlossaryTypes, ModelData[]>, options:GlossaryOptions): Promise<void> {
    if (options.skip && options.skip.glossary){ return; }
    for (const table in glossaryEntries){
        for (const doc of glossaryEntries[table]){
            await createRow(campaignId, table, doc, options);
        }
    }
}

async function createAttributes(campaignId:number, attributes:ModelData[], options:GlossaryOptions): Promise<void> {
    if (options.skip && options.skip.attributes){ return; }
    for (const doc of attributes){
        await createRow(campaignId, 'attribute', doc, options);
    }
}

async function createSkillEntries(campaignId:number, skillEntries:Record<SkillTableTypes, ModelData[]>, options:GlossaryOptions): Promise<void> {
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

async function createRow(campaignId:number, table:string, data:ModelData, options:{[key:string]:unknown}): Promise<void>{
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

async function attributeSorter(attributes:ModelData[], campaignId:number): Promise<ModelData[]>{
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
            if (typeof a.name === 'string' && typeof b.name === 'string'){
                return a.name.localeCompare(b.name);
            }
            return 0;
        }
    });

};

// Sort a list of characters by user, then active, then name
function characterSorter(a, b){
    if (a.user_id !== b.user_id){
        return a.user.name.localeCompare(b.user.name);
    }
    if (a.active !== b.active){
        if (a.active) { return -1; }
        if (b.active) { return 1; }
    }
    return a.name.localeCompare(b.name);
}

interface cpData{
    base:number
    total:number
    usable:number
}
async function cpCalculator(userId:number, campaignId:number): Promise<cpData> {
    const campaign = await models.campaign.get(campaignId);
    const cpGrants = await models.cp_grant.find({user_id:userId, campaign_id:campaignId, status:'approved'});
    const result:cpData = {
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


async function getCharacterCSV(campaignId: number, characters:ModelData[]): Promise<string> {
    const custom_fields = await models.custom_field.find({campaign_id:campaignId});
    const skill_source_types = await models.skill_source_type.find({campaign_id:campaignId});
    const skill_sources = await models.skill_source.find({campaign_id:campaignId});
    const data = [];
    const campaign = await req.models.campaign.get(campaignId);
    const header = ['Name', 'Pronouns', 'Player', 'Active', campaign.renames.cp.singular, 'Extra Traits'];
    for (const skill_source_type of skill_source_types){
        const optionalSources = _.where(skill_sources, {type_id: skill_source_type.id, required:false});
        if (!optionalSources.length){ continue; }
        header.push(skill_source_type.name);

    }
    for (const custom_field of custom_fields){
        header.push(custom_field.name);
    }
    data.push(header);
    for (const character of characters){
        const user = await models.user.get(campaignId, Number(character.user_id));
        const row = [];
        row.push(character.name);
        row.push(character.pronouns);
        row.push(user.name);
        row.push(character.active?'Yes':'No');
        row.push(character.cp);
        row.push(character.extra_traits);

        const character_sources = await models.character_skill_source.find({character_id:character.id});

        for (const skill_source_type of skill_source_types){
            const optionalSources = _.where(skill_sources, {type_id: skill_source_type.id, required:false});
            if (!optionalSources.length){ continue; }

            const sources = [];
            for(const skill_source of optionalSources){
                if (_.findWhere(character_sources, {skill_source_id:skill_source.id})){
                    sources.push(skill_source.name);
                }
            }
            row.push(sources.join(', '));
        }

        const character_custom_fields = await models.character_custom_field.find({character_id:character.id});

        for (const custom_field of custom_fields){
            const character_field = _.findWhere(character_custom_fields, {custom_field_id: custom_field.id});
            if (character_field){
                row.push(character_field.value);
            } else {
                row.push(null);
            }
        }

        data.push(row);
    }

    return stringify(data, {});
};

async function parseTime(campaignId:number, date: string, hour:number){
    const campaign = await models.campaign.get(campaignId);
    const timezone = campaign.timezone;
    const dateStr = `${date} ${String(hour).padStart(2, '0')}:00:00`;
    return moment.tz(dateStr, timezone).toDate();
}

async function splitTime(campaignId:number, time:Date){
    const campaign = await models.campaign.get(campaignId);
    const timezone = campaign.timezone;
    const parsed = moment.utc(time).tz(timezone);
    return {
        date: parsed.format('YYYY-MM-DD'),
        hour: Number(parsed.format('H'))
    }
}

async function getPostEventSurveys(userId: number, events:ModelData[]){
    const postEventSurveys = [];
    for (const event of events as EventData[]){
        if (!event.post_event_survey_id){ continue; }
        const attendance: AttendanceData = _.findWhere(event.attendees as ModelData[], {user_id: userId});
        if (!attendance || !attendance.attending ){ continue; }
        postEventSurveys.push(surveyHelper.formatPostEventData(attendance, event));
    }

    return postEventSurveys.sort((a, b) => {
        return b.eventStartTime - a.eventStartTime;
    });
}
async function getDocumentations(campaignId: number, userId: number){
    const documentations = await models.documentation_user.find({campaign_id:campaignId, user_id:userId});
    for (const documentation of documentations){
        if (documentation.valid_from){
            const split = await splitTime(campaignId, documentation.valid_date);
            documentation.valid_date_date = split.date;
        }
    }
    return documentations;
}

async function getUserImage(campaignId:number, userId:number): Promise<ImageModel> {
    const user = await models.user.get(campaignId, userId);
    if (!user.image_id){
        return null;
    }
    return models.image.get(user.image_id);
}

function userSorter(a, b){
    if (a.typeForDisplay !== b.typeForDisplay){
        return a.typeOrder - b.typeOrder;
    }
    return a.name.localeCompare(b.name);
}

export default {
    init,
    getCharacterCSV,
    cpCalculator,
    attributeSorter,
    characterSorter,
    parseTime,
    splitTime,
    getPostEventSurveys,
    getDocumentations,
    getUserImage,
    userSorter
}
