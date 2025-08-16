'use strict';
import _ from 'underscore';
import async from 'async';
import Model from  '../lib/Model';
import database from '../lib/database';

import tagModel from './tag';
import locationModel from './location';
import scene_locationModel from './scene_location';
import timeslotModel from './timeslot';
import scene_timeslotModel from './scene_timeslot';
import userModel from './user';
import scene_userModel from './scene_user';
import sourceModel from './skill_source';
import scene_sourceModel from './scene_source';
import eventModel from './event';
import characterModel from './character';
import skillModel from './skill';
import scene_skillModel from './scene_skill';
import attendanceModel from './attendance';


const models = {
    tag: tagModel,
    location: locationModel,
    scene_location: scene_locationModel,
    timeslot: timeslotModel,
    scene_timeslot: scene_timeslotModel,
    user: userModel,
    scene_user: scene_userModel,
    source: sourceModel,
    scene_source: scene_sourceModel,
    event: eventModel,
    character: characterModel,
    skill: skillModel,
    scene_skill: scene_skillModel,
    attendance: attendanceModel
};


const tableFields = [
    'id',
    'campaign_id',
    'event_id',
    'guid',
    'name',
    'player_name',
    'status',
    'description',
    'schedule_notes',
    'printout_note',
    'timeslot_count',
    'setup_slots',
    'cleanup_slots',
    'display_to_pc',
    'prereqs',
    'player_count_min',
    'player_count_max',
    'staff_count_min',
    'staff_count_max',
    'combat_staff_count_min',
    'combat_staff_count_max',
    'locations_count',
    'staff_url',
    'player_url',
    'priority',
    'writer_id',
    'runner_id',
    'created',
    'updated'
];

const Scene = new Model('scenes', tableFields, {
    order: ['event_id', 'name'],
    postSelect:fill,
    preSave:preSave,
    postSave:postSave
});

async function fill(data: SceneModel){
    data.tags = await getTags(data.id as number);
    for (const table of ['location', 'timeslot', 'source', 'skill', 'user']){
        const records = await models[`scene_${table}`].find({scene_id:data.id});
        data[`${table}s`] = await async.map(records, async(record) => {
            let object = null;
            if (table === 'user'){
                object = await models[table].get(data.campaign_id, record.user_id)
                if (object.type === 'player' && data.event_id){
                    const attendance = await models.attendance.findOne({user_id:object.id, event_id:data.event_id, attending:true});
                    if (attendance && attendance.character_id){
                        object.character = await models.character.get(attendance.character_id);
                    }
                }
            } else {
                object = await models[table].get(record[`${table}_id`]);
            }
            object.scene_request_status = record.request_status;
            if (record.schedule_status){
                object.scene_schedule_status = record.schedule_status;
            }
            if (record.details){
                object.scene_details = record.details;
            }
            return object;
        });
        if (table === 'timeslot'){
            data.timeslots = _.sortBy(data.timeslots, 'start_minute');
            data.timeslots = _.sortBy(data.timeslots, 'start_hour');
            data.timeslots = _.sortBy(data.timeslots, 'day');
        }
    }
    if (data.event_id){
        data.event = await models.event.get(data.event_id, {postSelect:async (data)=>{return data;}});
    }
    if (typeof data.prereqs !== 'string'){
        data.prereqs = await async.map(data.prereqs as scenePrereq[], async(sceneId) => {
            if (typeof sceneId === 'number') {
                return Scene.get(sceneId);
            } else {
                return sceneId;
            }
        });
    }
    if (data.writer_id){
        data.writer = await models.user.get(data.campaign_id, data.writer_id);
    }
    if (data.runner_id){
        data.runner = await models.user.get(data.campaign_id, data.runner_id);
    }
    return data;
}

async function getTags(sceneId: number): Promise<TagModel[]>{
    const query = 'select * from scenes_tags where scene_id = $1';
    const result = await database.query(query, [sceneId]);
    const tags = await async.map(result.rows, async (scene_tag): Promise<TagModel> => {
        return models.tag.get(scene_tag.tag_id) as Promise<TagModel>;
    });

    return _.sortBy(tags, 'name');
}

async function preSave(data: SceneModel): Promise<SceneModel>{
    if (typeof data.prereqs === 'object'){
        if (data.prereqs.length && typeof data.prereqs[0] === 'object'){
            data.prereqs = _.pluck(data.prereqs, 'id');
        }
        data.prereqs = JSON.stringify(data.prereqs);
    }
    return data;
}
interface sceneElementStatuses{
    request?: string|null
    schedule?: string|null
}
async function postSave(sceneId:number, data:ModelData){
    await saveTags(sceneId, data);
    await async.each(['location', 'timeslot', 'source', 'user', 'skill'], async (table) => {
        if (_.has(data, `${table}s`)){
            const currentRecords = await models[`scene_${table}`].find({scene_id:sceneId});

            await async.each(data[`${table}s`] as ModelData[], async (record:ModelData) => {
                const statuses:sceneElementStatuses = {};
                if (_.has(record, 'scene_request_status')){
                    statuses.request = record.scene_request_status as string;
                }
                if (_.has(record, 'scene_schedule_status')){
                    statuses.schedule = record.scene_schedule_status as string;
                }

               return saveRecord(sceneId, table, record.id as number, statuses, record.scene_details as Record<string, unknown>);
            })

            await async.each(currentRecords as ModelData[], async (record:ModelData) => {
                if (_.findWhere(data[`${table}s`] as ModelData[], {id:'' + record[`${table}_id`]})){
                    return;
                }
                if (record.schedule_status === 'unscheduled' && record.request_status === 'none'){
                    return models[`scene_${table}`].delete(record);
                }
            });
        }
    });

}

async function saveRecord(sceneId:number, table:string, objectId:number, statuses:sceneElementStatuses, details:Record<string,unknown>){
    const doc = {
        scene_id: sceneId
    };
    doc[`${table}_id`] = objectId;
    let record = await models[`scene_${table}`].findOne(doc, {noCache:true});
    if (record){
        let changed = false;
        if (record.request_status && _.has(statuses, 'request') && record.request_status !== statuses.request){
            record.request_status = statuses.request;
            changed = true;
        }
        if (record.schedule_status && _.has(statuses, 'schedule') && record.schedule_status !== statuses.schedule){
            record.schedule_status = statuses.schedule;
            changed = true;
        }
        if (record.schedule_status === 'unscheduled' && record.request_status === 'none'){
            return models[`scene_${table}`].delete(doc);
        }
        if (details && !_.isEqual(details, record.details)){
            record.details = details;
            changed = true;
        }

        if (changed){
            return models[`scene_${table}`].update(doc, record);
        }
    } else {
        record = {
            scene_id: sceneId,
            schedule_status: 'unscheduled',
            request_status: 'none',
            details: null
        }
        if (statuses.request){
            record.request_status = statuses.request;
        }
        if (statuses.schedule){
            record.schedule_status = statuses.schedule;
        }
        if (details){
            record.details = details;
        }
        record[`${table}_id`] = objectId;
        if (record.schedule_status === 'unscheduled' && record.request_status === 'none'){
            return;
        }

        return models[`scene_${table}`].create(record);
    }
}

async function saveTags(sceneId:number, data:ModelData){

    if (!_.has(data, 'tags')){
        return;
    }

    const tags = data.tags;
    const currentQuery  = 'select * from scenes_tags where scene_id = $1';
    const insertQuery = 'insert into scenes_tags (scene_id, tag_id) values ($1, $2)';
    const deleteQuery = 'delete from scenes_tags where scene_id = $1 and tag_id = $2';
    const current = await database.query(currentQuery, [sceneId]);

    let newTags = [];
    for (const tag of (tags as object[])){
        if (_.isObject(tag)){
            newTags.push(tag.id);
        } else {
            newTags.push(tag);
        }
    }

    newTags = await async.map(newTags, async tagId => {
        if (isNaN(tagId)){
            const tag = await models.tag.getByName('scene', tagId, (data.campaign_id as number));
            return tag.id;
        }
        return Number(tagId);
    });

    for (const tagId of newTags){
        if(!_.findWhere(current.rows, {tag_id: tagId})){
            await database.query(insertQuery, [sceneId, tagId]);
        }
    }

    for (const row of current.rows){
        if(_.indexOf(newTags, row.tag_id) === -1){
            await database.query(deleteQuery, [sceneId, row.tag_id]);
        }
    }
}

export = Scene;
