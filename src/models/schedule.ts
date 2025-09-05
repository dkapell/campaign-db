'use strict';
import _ from 'underscore';
import config from 'config';
import Model from  '../lib/Model';
import cache from '../lib/cache';

import pg from 'pg';

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
   save?: (data:ModelData, client:pg.Client) => Promise<number|null>
   current?: (event_id:number, name:string ) => Promise<ModelData>
}

const Schedule: ScheduleModel = new Model('schedules', tableFields, {
    order: ['event_id', 'version desc'],
    preSave: preSave,
    postSave: postSave,
});

async function preSave(data:ModelData): Promise<ModelData>{
    for (const field of ['timeslots', 'locations', 'scenes', 'schedule_busies']){
        if (_.has(data, field)){
            data[field] = JSON.stringify(data[field]);
        }
    }
    return data;
}

async function postSave(id, data){
    await cache.invalidate('event-schedule', Number(data.event_id));
}

Schedule.save = async function save(data:ScheduleSnapshotModel): Promise<number|null>{
    const current = await this.find({
        event_id: data.event_id
    }, {
        excludeFields: ['timeslots', 'locations', 'scenes', 'schedule_busies']
    });
    let maxVal = 0;
    if (current.length){
        maxVal = _.max(_.pluck(current, 'version'));
    }
    data.version = maxVal+1;

    const id = await this.create(data);

    const maxVersions: number = config.get('scheduler.keepVersions') ;
    let saved = 0;
    for (const item of current){
        if (item.keep) { continue; } // Keep any marked as saved
        if (saved < maxVersions){ // Keep keepVersions of auto-generated ones
            saved++;
            continue;
        }
        await this.delete(item.id);
    }
    return id;
}

Schedule.current = async function current(event_id:number): Promise<ModelData>{
    let record = await cache.check('event-schedule', Number(event_id));
    if (record){
        return record;
    }
    record = await this.findOne({event_id:event_id});
    await cache.store('event-schedule', Number(event_id), record);
    return record;
}

export = Schedule;
