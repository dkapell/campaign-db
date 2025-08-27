'use strict';
import _ from 'underscore';
import async from 'async';
import { v4 as uuidv4 } from 'uuid';
import models from './models';
import scheduleHelper from './scheduleHelper';

function parseSurveyModel(data, survey, current, userType){
    data ||= {};
    const post_event_data = {};
    if (survey){
        for (const field of survey){
            if (field.visible_to === 'player' && !userType.match('player')){
                continue;
            }
            if (field.visible_to === 'staff' && userType.match('player')){
                continue;
            }
            if (userType.match(/^(core staff|admin)$/) || !field.editable_by || field.editable_by === 'submitter'){

                if (field.type === 'text content'){
                    continue;
                }

                const doc = {
                    name: field.name,
                    data: _.has(data, field.id)?data[field.id]:null
                };

                if (field.type === 'boolean'){
                    if(!_.has(data, field.id)){
                        doc.data = false;
                    } else {
                        doc.data = true;
                    }
                }
                if (doc.data !== ''){
                    post_event_data[field.id] = doc;
                }
            } else {
                post_event_data[field.id] = current[field.id];
            }
        }
    }
    return post_event_data;
}

function parseSurveyFields(input){
    let output = [];

    for (const id in input){
        if (id === 'new'){
            continue;
        }

        const surveyField = input[id];

        const doc: SurveyField = {
            name: surveyField.name,
            type: surveyField.type,
            icon: surveyField.icon,
            sort_order: surveyField.sort_order,
        }
        if (_.has(surveyField, 'id') && surveyField.id !== ''){
            doc.id = surveyField.id;
        } else {
            doc.id = uuidv4();
        }

        for (const field of ['required', 'on_checkin']){
            if (_.has(surveyField, field)){
                doc[field] = true;
            } else {
                doc[field] = false;
            }
        }

        if (_.has(surveyField, 'visible_to') && surveyField.visible_to !== ''){
            doc.visible_to = surveyField.visible_to;
        }
        if (_.has(surveyField, 'editable_by') && surveyField.editable_by !== ''){
            doc.editable_by = surveyField.editable_by;
        }

        if (_.has(surveyField, 'description') && surveyField.description !== ''){
            doc.description = surveyField.description;
        }

        if (_.has(surveyField, 'days_before') && surveyField.days_before !== ''){
            doc.days_before = Number(surveyField.days_before);
        }

        switch(surveyField.type){
            case 'dropdown':
                if(_.has(surveyField, 'options') ){
                    doc.options = surveyField.options.split(/\s*,\s*/);
                }
                if(_.has(surveyField, 'placeholder') && surveyField.placeholder !== ''){
                    doc.placeholder = surveyField.placeholder;
                }
                break;
            case 'longtext':
                if (_.has(surveyField, 'rows') && surveyField.rows !== ''){
                    doc.rows = Number(surveyField.rows);
                }
                if (_.has(surveyField, 'maxlength') && surveyField.maxlength !== ''){
                    doc.maxlength = Number(surveyField.maxlength);
                }
                break;
            case 'text content':
                if (_.has(surveyField, 'content') && surveyField.content !== ''){
                    doc.content = surveyField.content;
                }
                break;
            case 'scene':
                if (_.has(surveyField, 'rows') && surveyField.rows !== ''){
                    doc.rows = Number(surveyField.rows);
                }
                if (_.has(surveyField, 'maxlength') && surveyField.maxlength !== ''){
                    doc.maxlength = Number(surveyField.maxlength);
                }
                break;
        }

        output.push(doc);
    }
    output = output.sort((a, b) => {
        return Number(a.sort_order) - Number(b.sort_order);
    });
    return output;
}

function formatPostEventModel(attendance, event){
    return {
        attendanceId: attendance.id,
        eventId: event.id,
        eventName: event.name,
        eventStartTime: event.start_time,
        eventEndTime: event.end_time,
        post_event_submitted: attendance.post_event_submitted,
        definition: event.post_event_survey.definition,
        checkedIn: attendance.checked_id,
        user: attendance.user,
        submittedAt: new Date(attendance.post_event_data.submitted_at),
        started: _.keys(attendance.post_event_data).length,
        deadline: event.post_event_survey_deadline,
        hidden: attendance.post_event_hidden,
        data:{},
        addendums:attendance.post_event_addendums?attendance.post_event_addendums.filter(addendum => {return addendum.submitted_at}).length:0,
        activeAddendum:!!(attendance.post_event_addendums && _.findWhere(attendance.post_event_addendums, {current:true})),
        type: 'post event response'
    }
}

async function formatPostEventResponses(response, event){
    const user = await models.user.get(event.campaign_id, response.user_id);
    const attendance = _.findWhere(event.attendees, {user_id:user.id});
    return {
        attendanceId: attendance.id,
        eventId: response.event_id,
        eventName: event.name,
        eventStartTime: event.start_time,
        eventEndTime: event.end_time,
        post_event_submitted: response.submitted,
        definition: event.post_event_survey.definition,
        user: user,
        submittedAt: new Date(response.submitted_at),
        started: _.keys(response.data).length,
        deadline: event.post_event_survey_deadline,
        data:{},
        addendums:attendance.post_event_addendums?attendance.post_event_addendums.filter(addendum => {return addendum.submitted_at}).length:0,
        activeAddendum:!!(attendance.post_event_addendums && _.findWhere(attendance.post_event_addendums, {current:true})),
        type: 'post event response',
    }
}

async function fillAttendance(attendance, event){
    if (event.pre_event_survey_id){
        if (attendance.pre_event_survey_response_id){
            const preEventResult = await models.survey_response.get(attendance.pre_event_survey_response_id);
            if (preEventResult){
                attendance.pre_event_data = preEventResult.data;
            }
        } else {
            // Migrated data
            const preEventResult = await models.survey_response.findOne({
                user_id:attendance.user_id,
                event_id:attendance.event_id,
                survey_id:event.pre_event_survey_id
            });
            if (preEventResult){
                attendance.pre_event_data = preEventResult.data;
            }
        }

        for (const field of event.pre_event_survey.definition){
            if (field.type === 'image' && _.has(attendance.pre_event_data, field.id)){
                if (!attendance.pre_event_data[field.id].data){
                    continue;
                }
                const image = await models.image.get(attendance.pre_event_data[field.id].data);
                if (image) {
                    attendance.pre_event_data[field.id].data = image;
                } else {
                    delete attendance.pre_event_data[field.id];
                }
            }
        }
    }

    if (event.post_event_survey_id && attendance.post_event_survey_response_id){
        const postEventResult = await models.survey_response.get(attendance.post_event_survey_response_id);
        if (postEventResult){
            attendance.post_event_data = postEventResult.data;
            if (postEventResult.submitted){
                attendance.post_event_submitted = true;
                attendance.post_event_data.submitted_at = postEventResult.submitted_at;
            }
        }

        for (const field of event.post_event_survey.definition){
            if (field.type === 'image' && _.has(attendance.post_event_data, field.id)){
                const image = await models.image.get(attendance.post_event_data[field.id].data);
                if (image){
                    attendance.post_event_data[field.id].data = image;
                } else {
                     delete attendance.post_event_data[field.id];
                }
            }
        }
    }

    const addendums = await models.post_event_addendum.find({attendance_id: attendance.id});
    attendance.post_event_addendums = [];
    for (const addendum of addendums){
        if (addendum.content === ''){ continue }
        attendance.post_event_addendums.push({
            submitted: addendum.submitted,
            submitted_at: addendum.submitted_at,
            current: !addendum.submitted,
            content: addendum.content
        });
    }

    return attendance;
}



async function savePreEventSurveyModel(responseId, attendance){
    if (!_.has(attendance, 'pre_event_data')){
        return null;
    }

    const event = await models.event.get(attendance.event_id);
    // Check for existing record
    if (responseId){
        const surveyResponse = await models.survey_response.get(responseId);
        surveyResponse.data = attendance.pre_event_data;
        surveyResponse.updated = new Date();
        surveyResponse.survey_id = event.pre_event_survey_id;
        surveyResponse.survey_definition = JSON.stringify(event.pre_event_survey.definition);
        await models.survey_response.update(surveyResponse.id, surveyResponse);
        return surveyResponse.id;

    } else {
        // Handle unmigrated data
        const surveyResponse = await models.survey_response.findOne({
            event_id: event.id,
            user_id: attendance.user_id,
            survey_id: event.pre_event_survey_id
        });
        if (surveyResponse){
            surveyResponse.data = attendance.pre_event_data;
            surveyResponse.updated = new Date();
            surveyResponse.survey_id = event.pre_event_survey_id;
            surveyResponse.survey_definition = JSON.stringify(event.pre_event_survey.definition);
            await models.survey_response.update(surveyResponse.id, surveyResponse);
            return surveyResponse.id;
        }
        // Create new record
        const doc = {
            campaign_id: event.campaign_id,
            user_id: attendance.user_id,
            survey_id: event.pre_event_survey_id,
            event_id: attendance.event_id,
            survey_definition: JSON.stringify(event.pre_event_survey.definition),
            data: attendance.pre_event_data,
            submitted:true,
            submitted_at: new Date(),
        }
        return models.survey_response.create(doc);
    }
}

async function getPostEventSurveys(campaignId:number, userId?:number){
    const responses = [];
    const surveys = await models.survey.find({campaign_id: campaignId, type:'post event'});
    const events:EventModel[] = await models.event.find({campaign_id:campaignId, deleted:false});
    const campaign = await models.campaign.get(campaignId);
    for (const survey of surveys){
        interface SurveyQuery {
            survey_id: number
            submitted?: boolean
            user_id?: number
        }

        const query: SurveyQuery = {
            survey_id: survey.id,
            submitted:true
        };
        if (userId){
            query.user_id = userId;
        }

        const surveyResponses = await models.survey_response.find(query);
        for (const response of surveyResponses){
            const event = _.findWhere(events, {id:response.event_id});
            const visibleAt = new Date(event.end_time);
            visibleAt.setDate(visibleAt.getDate() + campaign.post_event_survey_hide_days);
            if (visibleAt > new Date()){
                continue;
            }
            responses.push(await formatPostEventResponses(response, event));

        }
    }
    return (_.sortBy(responses, 'submittedAt')).reverse();
}

async function getSceneFeedbacks(attendanceId){
    const attendance = await models.attendance.get(attendanceId);
    const event = await models.event.get(attendance.event_id);
    const allTimeslots = await models.timeslot.find({campaign_id:event.campaign_id});
    let feedbacks = await models.scene_feedback.find({survey_response_id: attendance.post_event_survey_response_id});
    feedbacks = feedbacks.filter(feedback => { return !feedback.skipped});
    feedbacks = await async.map(feedbacks, async (feedback) => {
        feedback.scene = scheduleHelper.formatScene(await models.scene.get(feedback.scene_id));
        return feedback;
    });


    return feedbacks.sort((a, b) => {
        if (a.scene.timeslots.confirmed && b.scene.timeslots.confirmed){
            if (a.scene.timeslots.confirmed[0].id !== b.scene.timeslots.confirmed[0].id){
                return _.indexOf(allTimeslots, a.scene.timeslots.confirmed[0].id) - _.indexOf(allTimeslots, b.scene.timeslots.confirmed[0].id)
            }
        } else if (a.scene.timeslots.confirmed){
            return -1;
        } else if (b.scene.timeslots.confirmed){
            return 1;
        }
        return a.scene.name.localeCompare(b.scene.name);
    });
}

export default {
    parseData: parseSurveyModel,
    parseFields: parseSurveyFields,
    formatPostEventModel: formatPostEventModel,
    formatPostEventResponses: formatPostEventResponses,
    fillAttendance: fillAttendance,
    savePreEventModel: savePreEventSurveyModel,
    getPostEventSurveys: getPostEventSurveys,
    getSceneFeedbacks
}
