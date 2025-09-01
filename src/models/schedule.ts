'use strict';
import _ from 'underscore';
import config from 'config';
import database from '../lib/database';
import Model from  '../lib/Model';

import eventModel from './event';

const models = {
    event: eventModel
};

const tableFields = [
    'id',
    'event_id',
    'name',
    'timeslots',
    'locations',
    'scenes',
    'schedule_busies',
    'read_only',
    'version',
    'keep',
    'created',
    'metadata'
];

interface ScheduleModel extends IModel {
   save?: (data:ModelData) => Promise<number|null>
   current?: (event_id:number, name:string ) => Promise<ModelData>
}

const Schedule: ScheduleModel = new Model('schedules', tableFields, {
    order: ['event_id', 'version desc'],
    preSave: preSave
});

async function preSave(data:ModelData): Promise<ModelData>{
    for (const field of ['timeslots', 'locations', 'scenes', 'schedule_busies']){
        if (_.has(data, field)){
            data[field] = JSON.stringify(data[field]);
        }
    }
    return data;
}

Schedule.save = async function save(data:ScheduleSnapshotModel): Promise<number|null>{
    const event = await models.event.get(Number(data.event_id), {postSelect: async(data)=>{return data}});
    const client = await database.connect();
    try{
        await client.query('select pg_advisory_lock($1, $2)', [event.campaign_id, event.id]);
    } catch(err){
        console.trace(err);
        throw err;
    }
    const current = await this.find({
        event_id: data.event_id
    }, {
        excludeFields: ['timeslots', 'locations', 'scenes', 'schedule_busies'],
        client: client
    });
    let maxVal = 0;
    if (current.length){
        maxVal = _.max(_.pluck(current, 'version'));
    }
    data.version = maxVal+1;

    data.metadata = {
        scenes: {
            scheduled: (_.where(data.scenes, {status: 'scheduled'})).length,
            confirmed: (_.where(data.scenes, {status: 'confirmed'})).length
        },
        timeslots: data.timeslots.length,
        locations: data.locations.length,
        schedule_busies: data.schedule_busies.length
    };
    const id = await this.create(data, {client:client});

    const maxVersions: number = config.get('scheduler.keepVersions') ;
    let saved = 0;
    for (const item of current){
        if (item.keep) { continue; } // Keep any marked as saved
        if (saved < maxVersions){ // Keep keepVersions of auto-generated ones
            saved++;
            continue;
        }
        await this.delete(item.id, {client:client});
    }
    await client.query('select pg_advisory_unlock($1, $2)', [event.campaign_id, event.id]);
    await client.release(true);
    return id;
}

Schedule.current = async function current(event_id:number): Promise<ModelData>{
    return this.findOne({event_id:event_id});
}

export = Schedule;
