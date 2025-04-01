'use strict';
import _ from 'underscore';
import { v4 as uuidv4 } from 'uuid';

function parseSurveyData(data, survey, current, userType){
    const post_event_data = {};
    if (survey){
        for (const field of survey){
            if (userType.match(/^(core staff|admin)$/) || field.editable_by === 'submitter'){
                const doc = {
                    name: field.name,
                    data: data[field.id]
                };
                if (field.type === 'text content'){
                    continue;
                }
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
        }

        output.push(doc);
    }
    output = output.sort((a, b) => {
        return Number(a.sort_order) - Number(b.sort_order);
    });
    return output;
}

function formatPostEventData(attendance, event){
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
        submittedAt: attendance.post_event_data.submitted_at,
        started: _.keys(attendance.post_event_data).length,
        deadline: event.post_event_survey_deadline,
        hidden: attendance.post_event_hidden,
        data:{},
        addendums:attendance.post_event_addendums?attendance.post_event_addendums.filter(addendum => {return addendum.submitted_at}).length:0,
        activeAddendum:!!(attendance.post_event_addendums && _.findWhere(attendance.post_event_addendums, {current:true}))
    }
}

export default {
    parseData: parseSurveyData,
    parseFields: parseSurveyFields,
    formatPostEventData: formatPostEventData
}
