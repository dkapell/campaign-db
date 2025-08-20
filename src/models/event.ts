'use strict';

import validator from 'validator';
import _ from 'underscore';
import async from 'async';
import Model from  '../lib/Model';
import attendanceModel from './attendance';
import surveyModel from './survey';
import eventAddonModel from './event_addon';
import surveyHelper from '../lib/surveyHelper';
import documentation_userModel from './documentation_user';
import database from '../lib/database';

const models = {
    attendance: attendanceModel,
    survey: surveyModel,
    event_addon: eventAddonModel,
    documentation_user: documentation_userModel
};

interface EventIModel extends IModel {
   next?: (campaign_id:number) => Promise<ModelData>
}

const tableFields = [
    'id',
    'campaign_id',
    'name',
    'guid',
    'description',
    'start_time',
    'end_time',
    'registration_open',
    'cost',
    'location',
    'deleted',
    'created',
    'hide_attendees',
    'post_event_survey_deadline',
    'pre_event_survey_id',
    'post_event_survey_id',
    'schedule_status',
    'schedule_read_only'
];

const Event: EventIModel= new Model('events', tableFields, {
    order: ['start_time'],
    validator: validate,
    postSelect: fill,
    postSave: postSave,
    skipAuditFields: ['created', 'deleted']
});

Event.next = async function(campaign_id:number): Promise<ModelData>{
    const select = 'select * from events where end_time > now() and campaign_id = $1 order by start_time asc limit 1';
    const result = await database.query(select, [campaign_id]);
    if (result.rows.length){
        return result.rows[0];
    }
}

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

async function fill(record){

    if (record.pre_event_survey_id){
        record.pre_event_survey = await models.survey.get(record.pre_event_survey_id);
    }

    if (record.post_event_survey_id){
        record.post_event_survey = await models.survey.get(record.post_event_survey_id);
    }

    record.addons = await models.event_addon.find({campaign_id: record.campaign_id, event_id:record.id});

    record.attendees = await models.attendance.find({event_id:record.id});
    record.attendees = await async.map(record.attendees, async (attendee) => {
        return surveyHelper.fillAttendance(attendee, record);
    })
    record.attendees = await async.map(record.attendees, async (attendee) => {
        attendee.documentations = await models.documentation_user.find({campaign_id:record.campaign_id, user_id:attendee.user_id});
        return attendee;
    });

    record.attendees = record.attendees.sort(attendeeSorter);
    record.players = record.attendees.filter(attendee => {return attendee.user.type === 'player'});

    return record;
}

export = Event;


function attendeeSorter(a, b){
    if (a.attending !== b.attending){
        return a.attending ? 1: -1;
    }
    if (a.user.typeForDisplay !== b.user.typeForDisplay){
        return a.user.typeOrder - b.user.typeOrder;
    }
    return a.user.name.localeCompare(b.user.name);
}


async function postSave(id:number, data:ModelData):Promise<void>{
    if (_.has(data, 'addons')){
        const current = await models.event_addon.find({campaign_id: Number(data.campaign_id), event_id:id});
        const updatedIds = [];
        for (const addon of data.addons as ModelData[]){

            addon.campaign_id = data.campaign_id;
            addon.event_id = id;

            if (addon.id === 'new' ){
                await models.event_addon.create(addon);
                continue;
            }

            if (!_.findWhere(current, {id:Number(addon.id)})){
                throw new Error('Updating a missing addon');
            }

            await models.event_addon.update(Number(addon.id), addon);
            updatedIds.push(Number(addon.id));
        }

        for (const addon of current){
            if (_.indexOf(updatedIds, Number(addon.id)) === -1){
                await models.event_addon.delete(Number(addon.id));
            }
        }
    }
}
