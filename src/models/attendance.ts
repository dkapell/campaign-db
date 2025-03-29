'use strict';

import _ from 'underscore';
import Model from  '../lib/Model';

import userModel from './user';
import characterModel from './character';
import attendanceAddonModel from './attendance_addon'

const models = {
    user: userModel,
    character: characterModel,
    attendance_addon: attendanceAddonModel
};

const tableFields = [
    'id',
    'campaign_id',
    'event_id',
    'user_id',
    'character_id',
    'paid',
    'notes',
    'data',
    'post_event_data',
    'post_event_submitted',
    'attending',
    'created',
    'checked_in'
];

const Attendance = new Model('attendance', tableFields, {
    postSelect: fill,
    postSave: postSave,
    skipAuditFields: ['event_id', 'created']
});

async function fill(record){
    if (record.user_id){
        record.user = await models.user.get(record.campaign_id, record.user_id);
    }
    if (record.character_id){
        record.character = await models.character.get(record.character_id);
    }

    record.addons = await models.attendance_addon.find({campaign_id: record.campaign_id, attendance_id:record.id});
    return record;
}

export = Attendance;

async function postSave(id:number, data:ModelData):Promise<void>{
    if (_.has(data, 'addons')){
        const current = await models.attendance_addon.find({campaign_id: Number(data.campaign_id), attendance_id:id});
        const updatedIds = [];
        for (const addon of data.addons as ModelData[]){

            addon.campaign_id = data.campaign_id;
            addon.attendance_id = id;

            if (!addon.id){
                await models.attendance_addon.create(addon);
                continue;
            }

            if (!_.findWhere(current, {id:Number(addon.id)})){
                throw new Error('Updating a missing addon');
            }

            await models.attendance_addon.update(Number(addon.id), addon);
            updatedIds.push(Number(addon.id));
        }

        for (const addon of current){
            if (_.indexOf(updatedIds, Number(addon.id)) === -1){
                await models.attendance_addon.delete(Number(addon.id));
            }
        }
    }
}
