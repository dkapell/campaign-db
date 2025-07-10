'use strict';
import _ from 'underscore';
import config from 'config';
import Model from  '../lib/Model';

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
    'created'
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

Schedule.save = async function save(data:ModelData): Promise<number|null>{
    const current = await this.find({
        event_id: data.event_id
    }, {
        excludeFields: ['timeslots', 'locations', 'scenes', 'schedule_busies']
    });
    const maxVal = _.max(_.pluck(current, 'version'));
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
    data.version = maxVal+1;
    return this.create(data);
}

Schedule.current = async function current(event_id:number): Promise<ModelData>{
    return this.findOne({event_id:event_id});
}

export = Schedule;
