'use strict';

import _ from 'underscore';
import Model from  '../lib/Model';

import userModel from './user';
import characterModel from './character';
import attendanceAddonModel from './attendance_addon';
import surveyResponseModel from './survey_response';

const models = {
    user: userModel,
    character: characterModel,
    attendance_addon: attendanceAddonModel,
    survey_response: surveyResponseModel
};

const tableFields = [
    'id',
    'campaign_id',
    'event_id',
    'user_id',
    'character_id',
    'paid',
    'notes',
    'pre_event_survey_response_id',
    'post_event_survey_response_id',
    'attending',
    'created',
    'checked_in',
    'attendance_cp_granted',
    'post_event_cp_granted',
    'post_event_hidden'
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
    record.addons = await models.attendance_addon.find({attendance_id:record.id});

    record.post_event_data = {};
    record.pre_event_data = {};
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
