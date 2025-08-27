import _ from 'underscore';
import removeMd from 'remove-markdown';
import moment from 'moment';
import stringify from 'csv-stringify-as-promised';

import surveyHelper from '../../lib/surveyHelper';
import scheduleHelper from '../../lib/scheduleHelper';

async function showPostEventSurvey(req, res, next){
    const id = req.params.id;
    //const attendanceId = req.params.attendanceId;

    res.locals.csrfToken = req.csrfToken();
    try{
        const user = req.session.activeUser;

        const event = await req.models.event.get(id);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        if (!event.post_event_survey){
            req.flash('warning', 'No Post-Event Survey configured for this event.');
            return res.redirect('/');
        }

        res.locals.event = event;
        if (req.query.backto === 'list'){
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/post_event_survey', name: req.campaign.renames.post_event_survey.plural },
                ],
                current: `${event.name}`
            }
        } else {
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/event', name: 'Events'},
                    { url: `/event/${event.id}`, name: event.name},
                ],
                current: req.campaign.renames.post_event_survey.singular
            };
        }

        const attendance = await req.models.attendance.findOne({event_id:event.id, user_id:user.id});
        if (!attendance || attendance.event_id !== event.id){
            throw new Error ('Invalid Attendance');
        }
        res.locals.attendance = await surveyHelper.fillAttendance(attendance, event);


        if (_.has(req.session, 'postEventModel')){
            res.locals.attendance.post_event_data = req.session.postEventModel.post_event_data;
            delete req.session.postEventModel;
        }

        if (req.query.backto === 'list'){
            res.locals.backto = 'list';
        } else if (req.query.backto === 'event'){
            res.locals.backto = 'event';
        } else {
            res.locals.backto = 'front';
        }

        res.render ('event/attendance/post_event_survey');
    } catch (err) {
        return next(err);
    }
}

async function submitPostEventSurvey(req, res){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    const attendance = req.body.attendance;
    req.session.postEventModel = attendance;
    const action = req.body.action ||= 'save';

    try {
        const user = req.session.activeUser;

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        const current = await req.models.attendance.get(attendanceId);

        if (!current || current.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        //if (! user.type.match(/^(core staff|admin)$/) && current.user_id !== user.id){
        if (current.user_id !== user.id){
            throw new Error('Not allowed to edit this post event survey');
        }

        if (!event.post_event_survey){
             throw new Error(`Event does not have a ${req.campaign.renames.post_event_survey.singular}`);
        }

        let surveyResult = null;
        if (current.post_event_survey_response_id){
            surveyResult = await req.models.survey_response.get(current.post_event_survey_response_id)
            if (surveyResult.submitted){
                return res.json({success:false, message: `${req.campaign.renames.post_event_survey.singular} already submitted`});
            }
        } else {
            surveyResult = {
                campaign_id: event.campaign_id,
                user_id: user.id,
                event_id: event.id,
                submitted:false,
                data: {}
            };
        }

        surveyResult.survey_id = event.post_event_survey_id;
        surveyResult.survey_definition = JSON.stringify(event.post_event_survey.definition);
        surveyResult.updated = new Date();

        surveyResult.data = surveyHelper.parseData(
            attendance.post_event_data,
            event.post_event_survey.definition,
            surveyResult.data,
            user.type
        );

        let cpGranted = false;
        switch (action){
            case 'hide':
                current.post_event_hidden = true;
                await req.models.attendance.update(current.id, current);
                break;
            case 'unhide':
                current.post_event_hidden = false;
                await req.models.attendance.update(current.id, current);
                break;
            case 'submit':
                surveyResult.submitted = true;
                surveyResult.submitted_at = new Date();
                if (req.campaign.post_event_survey_cp && !current.post_event_cp_granted && current.user.type === 'player'){
                    if (new Date(event.post_event_survey_deadline) > new Date()){
                        await req.models.cp_grant.create({
                            campaign_id: req.campaign.id,
                            user_id: current.user_id,
                            content: `${req.campaign.renames.post_event_survey.singular} for ${event.name}`,
                            amount: req.campaign.post_event_survey_cp,
                            status: 'approved'
                        });
                        await req.models.attendance.update(current.id, {post_event_cp_granted:true});
                        cpGranted = true;
                    }
                }
                break;
        }
        if (current.post_event_survey_response_id){
            await req.models.survey_response.update(surveyResult.id, surveyResult);

        } else {
            const surveyResponseId = await req.models.survey_response.create(surveyResult);
            await req.models.attendance.update(current.id, {post_event_survey_response_id:surveyResponseId});
        }
        delete req.session.postEventModel;

        switch (action){
            case 'hide':
                req.flash('success', `${req.campaign.renames.post_event_survey.singular} for ${event.name} has been removed from the Task List.`);
                break
            case 'unhide':
                req.flash('success', `${req.campaign.renames.post_event_survey.singular} for ${event.name} has been restored to the Task List.`);
                break
            case 'submit': {
                let resultStr = `Submitted ${req.campaign.renames.post_event_survey.singular} for ${event.name}`;
                if (cpGranted){
                    resultStr += ` and granted ${req.campaign.post_event_survey_cp} ${req.campaign.renames.cp.singular}.`;
                } else {
                    resultStr += '.';
                }
                req.flash('success', resultStr);
                break;
            }
            default:
                req.flash('success', `Saved ${req.campaign.renames.post_event_survey.singular} for ${event.name} for later submission.`);
                break;
        }

        if (req.body.backto === 'list'){
            res.redirect(`/post_event_survey`);
        } else if (req.body.backto === 'event'){
            res.redirect(`/event/${event.id}`);
        } else {
            res.redirect('/');
        }
    } catch (err){
        req.flash('error', err.toString());
        return (res.redirect(`/event/${eventId}/post_event/${attendanceId}`));
    }

}

async function savePostEventSurveyApi(req, res){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    const attendance = req.body.attendance;

    try {
        const user = req.session.activeUser;

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        const current = await req.models.attendance.get(attendanceId);


        if (!current || current.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        //if ((! user.type.match(/^(core staff|admin)$/)) && current.user_id !== user.id){
        if (current.user_id !== user.id){
            throw new Error('Not allowed to edit this post event survey');
        }

        if (!event.post_event_survey){
             throw new Error(`Event does not have a ${req.campaign.renames.post_event_survey.singular}`);
        }

        let surveyResult = null;
        if (current.post_event_survey_response_id){
            surveyResult = await req.models.survey_response.get(current.post_event_survey_response_id)
            if (surveyResult.submitted){
                return res.json({success:false, message: `${req.campaign.renames.post_event_survey.singular} already submitted`});
            }
        } else {
            surveyResult = {
                campaign_id: event.campaign_id,
                user_id: user.id,
                event_id: event.id,
                submitted:false,
                data: {}
            };
        }
        surveyResult.survey_id = event.post_event_survey_id;
        surveyResult.survey_definition = JSON.stringify(event.post_event_survey.definition);
        surveyResult.updated = new Date();
        surveyResult.data = surveyHelper.parseData(
            attendance.post_event_data,
            event.post_event_survey.definition,
            surveyResult.data,
            user.type
        );

        if (current.post_event_survey_response_id){
            await req.models.survey_response.update(surveyResult.id, surveyResult);

        } else {
            const surveyResponseId = await req.models.survey_response.create(surveyResult);
            await req.models.attendance.update(current.id, {post_event_survey_response_id:surveyResponseId});
        }

        res.json({success:true});

    } catch (err){
        res.json({success:false, error:err.message});
    }
}

async function exportPostEventSurveys(req, res, next){
    const eventId = req.params.id;
    try{
        const event = await req.models.event.get(eventId);
        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        const post_event_surveys = event.attendees.filter(attendance => {
                if (!attendance.post_event_submitted){
                    return false;
                }
                const visibleAt = new Date(event.end_time);
                visibleAt.setDate(visibleAt.getDate() + req.campaign.post_event_survey_hide_days);
                if (visibleAt > new Date()){
                    return false;
                }
                return true;
            }).map((attendance) => {
                const doc = surveyHelper.formatPostEventModel(attendance, event);
                doc.data = attendance.post_event_data
                return doc;
            });

        const output = [];
        const header = [
            'Attendee',
            'Type',
            'Submitted'
        ];
        if (event.post_event_survey){
            for (const field of event.post_event_survey.definition){
                if (field.type === 'text content') { continue; }
                if (field.type === 'scene') { continue; }
                header.push(removeMd(field.name));
            }
        }
        output.push(header);
        for (const survey of post_event_surveys){
            const row = [
                survey.user.name,
                survey.user.typeForDisplay,
                moment.utc(survey.submittedAt).tz(req.campaign.timezone).format('lll')
            ];
            if (event.post_event_survey){
                for (const field of event.post_event_survey.definition){
                    if (field.type === 'text content') { continue; }
                    if (field.type === 'scene') { continue; }
                    if (field.type==='boolean' || field.type === 'image'){
                        if (_.has(survey.data, field.id)){
                            row.push(survey.data[field.id].data?'Yes':'No');
                        } else {
                            row.push('No');
                        }
                    } else {
                        if (_.has(survey.data, field.id)){
                            row.push(removeMd(survey.data[field.id].data));
                        } else {
                            row.push(null);
                        }
                    }
                }
            }
            output.push(row);
        }
        const csvOutput = await stringify(output, {});
        res.attachment(`${event.name} - ${req.campaign.renames.post_event_survey.plural}.csv`);
        res.end(csvOutput);

    } catch (err) {
        next(err);
    }
}

async function exportPostEventSceneSurveys(req, res, next){
    const eventId = req.params.id;
    try{
        const event = await req.models.event.get(eventId);
        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        if (!event.post_event_survey){
            throw new Error('Event is not configured with a post event survey');
        }

        const attendances = event.attendees
            .filter(attendance => {
                if (!attendance.post_event_submitted){
                    return false;
                }
                const visibleAt = new Date(event.end_time);
                visibleAt.setDate(visibleAt.getDate() + req.campaign.post_event_survey_hide_days);
                if (visibleAt > new Date()){
                    return false;
                }
                return true;
            })



        const output = [];
        const header = [
            'Attendee',
            'Type',
            'Submitted',
            'Scene',
            'Timeslot',
            'Writer',
            'Staff',
            'GM Feedback',
            'NPC Feedback'
        ];

        output.push(header);

        let sceneOutput = [];
        for (let attendance of attendances){
            attendance = await surveyHelper.fillAttendance(attendance, event);
            const feedbacks = (await req.models.scene_feedback.find({survey_response_id:attendance.post_event_survey_response_id}))
                .filter(feedback => {return !feedback.skipped});;
            for (const feedback of feedbacks){
                const scene = scheduleHelper.formatScene(await req.models.scene.get(feedback.scene_id));
                let timeslotName = scene.timeslots.confirmed[0].name;
                if (scene.timeslots.confirmed[0].display_name){
                    timeslotName += ` (${scene.timeslots.confirmed[0].display_name})`
                }
                sceneOutput.push([
                    attendance.user.name,
                    attendance.user.typeForDisplay,
                    moment.utc(attendance.post_event_data.submitted_at).tz(req.campaign.timezone).format('lll'),
                    scene.name,
                    timeslotName,
                    scene.writer?scene.writer.name:null,
                    scene.staff.confirmed?(_.pluck(scene.staff.confirmed, 'name')).join(', '):null,
                    feedback.gm_feedback?removeMd(feedback.gm_feedback):null,
                    feedback.npc_feedback?removeMd(feedback.npc_feedback):null
                ]);

            }
        }
        sceneOutput = sceneOutput.sort((a, b) => {
            return a[3].localeCompare(b[3]);
        });

        for (const row of sceneOutput){
            output.push(row);
        }

        const csvOutput = await stringify(output, {});
        res.attachment(`${event.name} - ${req.campaign.renames.post_event_survey.plural} - scenes.csv`);
        res.end(csvOutput);

    } catch (err) {
        next(err);
    }
}
async function showAddendum(req, res, next){
    const id = req.params.id;
    //const attendanceId = req.params.attendanceId;

    res.locals.csrfToken = req.csrfToken();
    try{
        const user = req.session.activeUser;

        const event = await req.models.event.get(id);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        if (!event.post_event_survey){
            req.flash('warning', 'No Post-Event Survey configured for this event.');
            return res.redirect('/');
        }

        res.locals.event = event;
        if (req.query.backto === 'list'){
               res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/post_event_survey', name: req.campaign.renames.post_event_survey.plural },
                ],
                current: `${event.name} Addendum`
            };
        } else {
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/event', name: 'Events'},
                    { url: `/event/${event.id}`, name: event.name},
                ],
                current: `${req.campaign.renames.post_event_survey.singular} Addendum`
            };
        }

        let attendance = await req.models.attendance.findOne({event_id:event.id, user_id:user.id});
        if (!attendance || attendance.event_id !== event.id){
            throw new Error ('Invalid Attendance');
        }
        attendance = await surveyHelper.fillAttendance(attendance, event);
        if (!attendance.post_event_submitted){
            req.flash('warning', `${req.campaign.renames.post_event_survey.singular} not yet submitted.`)
            return res.redirect('/post_event_survey');
        }

        res.locals.attendance = attendance;

        const addendum = await req.models.post_event_addendum.findOne({submitted:false, user_id:user.id, event_id:event.id});
        if (addendum){
            res.locals.addendum = addendum;
        } else {
            res.locals.addendum = {
                content:null
            }
        }

        if (_.has(req.session, 'addendumData')){
            res.locals.addendum = req.session.addendumData;
            delete req.session.addendumData;
        }

        if (req.query.backto === 'list'){
            res.locals.backto = 'list';
        } else if (req.query.backto === 'event'){
            res.locals.backto = 'event';
        } else {
            res.locals.backto = 'front';
        }

        res.render ('event/attendance/post_event_addendum');
    } catch (err) {
        return next(err);
    }
}

async function submitAddendum(req, res){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    const addendum = req.body.addendum;
    req.session.addendumData = addendum;
    const action = req.body.action ||= 'save';

    try {
        const user = req.session.activeUser;

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        let current = await req.models.attendance.get(attendanceId);
        current = await surveyHelper.fillAttendance(current, event);

        if (!current || current.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        //if (! user.type.match(/^(core staff|admin)$/) && current.user_id !== user.id){
        if (current.user_id !== user.id){
            throw new Error('Not allowed to edit this post event survey');
        }

        if (!event.post_event_survey){
             throw new Error(`Event does not have a ${req.campaign.renames.post_event_survey.singular}`);
        }

        if (!current.post_event_submitted){
            req.flash('warning', `${req.campaign.renames.post_event_survey.singular} not yet submitted`);
            return res.redirect('/');
        }

        let currentAddendum = await req.models.post_event_addendum.findOne({submitted:false, user_id:user.id, event_id:event.id});
        if (!currentAddendum){
            currentAddendum = {
                campaign_id: event.campaign_id,
                user_id: user.id,
                attendance_id: current.id,
                submitted:false
            };
        }
        currentAddendum.updated = new Date();
        currentAddendum.content = addendum.content;


        if (action === 'submit') {
            currentAddendum.submitted = true
            currentAddendum.submitted_at = new Date();
        }

        if (currentAddendum.id){
            await req.models.post_event_addendum.update(currentAddendum.id, currentAddendum);
        } else {
            await req.models.post_event_addendum.create(currentAddendum);
        }


        delete req.session.addendumData;

        switch (action){
            case 'submit': {
                const resultStr = `Submitted ${req.campaign.renames.post_event_survey.singular} Addendum for ${event.name}.`;
                req.flash('success', resultStr);
                break;
            }
            default:
                req.flash('success', `Saved ${req.campaign.renames.post_event_survey.singular} Addendum for ${event.name} for later submission.`);
                break;
        }

        if (req.body.backto === 'list'){
            res.redirect(`/post_event_survey`);
        } else if (req.body.backto === 'event'){
            res.redirect(`/event/${event.id}`);
        } else {
            res.redirect('/');
        }
    } catch (err){
        req.flash('error', err.toString());
        return (res.redirect(`/event/${eventId}/post_event/${attendanceId}/addendum`));
    }

}


async function saveAddendumApi(req, res){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    const addendum = req.body.addendum;

    try {
        const user = req.session.activeUser;

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        let current = await req.models.attendance.get(attendanceId);
        current = await surveyHelper.fillAttendance(current, event);

        if (!current || current.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        //if ((! user.type.match(/^(core staff|admin)$/)) && current.user_id !== user.id){
        if (current.user_id !== user.id){
            throw new Error('Not allowed to edit this post event survey');
        }

        if (!current.post_event_submitted){
            return res.json({success:false, message: `${req.campaign.renames.post_event_survey.singular} not yet submitted`});
        }

        if (!event.post_event_survey){
             throw new Error(`Event does not have a ${req.campaign.renames.post_event_survey.singular}`);
        }

        let currentAddendum = await req.models.post_event_addendum.findOne({submitted:false, user_id:user.id, event_id:event.id});
        if (!currentAddendum){
            currentAddendum = {
                campaign_id: event.campaign_id,
                user_id: user.id,
                attendance_id: current.id,
                submitted:false
            };
        }
        currentAddendum.updated = new Date();
        currentAddendum.content = addendum.content;

        if (currentAddendum.id){
            await req.models.post_event_addendum.update(currentAddendum.id, currentAddendum);
        } else {
            await req.models.post_event_addendum.create(currentAddendum);
        }

        res.json({success:true});

    } catch (err){
        res.json({success:false, error:err.message});
    }
}

async function getUserSchedule(req, res){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId
    try{
        if (!req.campaign.display_schedule){
            throw new Error('Schedule not enabled on this campaign')
        }

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        if (event.end_time > new Date()){
            throw new Error('Event has not ended yet');
        }
        const attendance = await req.models.attendance.get(attendanceId);

        if (!attendance || attendance.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        const user = await req.models.user.get(event.campaign_id, req.session.activeUser.id);
        if (!user){
            throw new Error('Invalid User');
        }

        // Get staff version of schedule
        const schedule = await scheduleHelper.getUserSchedule(event.id, user.id, false);

        let scenes = (await scheduleHelper.getEventScenes(event.id)).filter(scene => {return scene.status === 'confirmed'});

        let userScenes = [];
        for (const timeslot of schedule){
            for (const scene of timeslot.scenes){
                if (attendance.post_event_survey_response_id){
                    const feedback = await req.models.scene_feedback.findOne({
                        survey_response_id:attendance.post_event_survey_response_id,
                        scene_id:scene.id
                    });
                    if (feedback){
                        for (const field of ['gm_feedback', 'npc_feedback', 'skipped']){
                            scene[field] = feedback[field];
                        }
                        scene.feedback_id = feedback.id;
                    }
                }
                if (!scene.skipped){
                    userScenes.push(scheduleHelper.formatSceneForSurvey(scene));
                }
            }
        }

        for (const scene of scenes){
            if (_.findWhere(userScenes, {id:scene.id})){
                continue;
            }
            const feedback = await req.models.scene_feedback.findOne({
                survey_response_id:attendance.post_event_survey_response_id,
                scene_id:scene.id
            });
            if (feedback && !feedback.skipped){
                for (const field of ['gm_feedback', 'npc_feedback', 'skipped']){
                    scene[field] = feedback[field];
                }
                userScenes.push(scheduleHelper.formatSceneForSurvey(scene));
            }
        }

        const allTimeslots = _.pluck(await req.models.timeslot.find({campaign_id: req.campaign.id}), 'id');

        userScenes = userScenes.sort((a, b) => {
            return _.indexOf(allTimeslots, a.timeslots[0].id) - _.indexOf(allTimeslots, b.timeslots[0].id)
        });

        scenes = scenes.sort((a, b) => {
            if (a.timeslots.confirmed && b.timeslots.confirmed){
                if (a.timeslots.confirmed[0].id !== b.timeslots.confirmed[0].id){
                    return _.indexOf(allTimeslots, a.timeslots.confirmed[0].id) - _.indexOf(allTimeslots, b.timeslots.confirmed[0].id)
                }
            } else if (a.timeslots.confirmed){
                return -1;
            } else if (b.timeslots.confirmed){
                return 1;
            }
            return a.name.localeCompare(b.name);
        });

        res.json({

            success:true,
            scenes: scenes.map(scheduleHelper.formatSceneForSurvey),
            userScenes: userScenes,
            isPlayer: user.type === 'player'
        });
    } catch (err) {
        res.json({success:false, error:err.message})
    }
}

async function getSceneApi(req, res){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    const sceneId = req.params.sceneId;
    try {
        if (!req.campaign.display_schedule){
            throw new Error('Schedule not enabled on this campaign')
        }

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        if (event.end_time > new Date()){
            throw new Error('Event has not ended yet');
        }
        const attendance = await req.models.attendance.get(attendanceId);

        if (!attendance || attendance.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        const user = await req.models.user.get(event.campaign_id, req.session.activeUser.id);
        if (!user){
            throw new Error('Invalid User');
        }

        const scene = scheduleHelper.formatScene(await req.models.scene.get(sceneId));
        if (!scene || scene.campaign_id !== req.campaign.id || scene.event_id !== event.id || scene.status !== 'confirmed'){
            throw new Error('Invalid Scene');
        }
        const response = await getResponse(req, event, attendance);
        const feedback = await req.models.scene_feedback.findOne({
            survey_response_id: response.id,
            scene_id: scene.id
        });
        if (feedback){
            for (const field of ['gm_feedback', 'npc_feedback', 'skipped']){
                scene[field] = feedback[field];
            }
            scene.feedback_id = feedback.id;
        }

        res.json({
            success:true,
            field: _.findWhere(event.post_event_survey.definition, {type:'scene'}),
            event: {id: event.id},
            attendance: {id: attendance.id, post_event_survey_response_id:response.id},
            scene: scheduleHelper.formatSceneForSurvey(scene)
        });
    } catch (err){
        console.trace(err);
        res.json({success:false, error:err.message})
    }
}

async function removeSceneApi(req, res){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    const sceneId = req.params.sceneId;
    try {
        if (!req.campaign.display_schedule){
            throw new Error('Schedule not enabled on this campaign')
        }

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        if (event.end_time > new Date()){
            throw new Error('Event has not ended yet');
        }
        const attendance = await req.models.attendance.get(attendanceId);

        if (!attendance || attendance.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        const user = await req.models.user.get(event.campaign_id, req.session.activeUser.id);
        if (!user){
            throw new Error('Invalid User');
        }

        const scene = await req.models.scene.get(sceneId);
        if (!scene || scene.campaign_id !== req.campaign.id || scene.event_id !== event.id || scene.status !== 'confirmed'){
            throw new Error('Invalid Scene');
        }

        const response = await getResponse(req, event, attendance);
        if (response.submitted){
            throw new Error ('Response already submitted');
        }

        const feedback = await req.models.scene_feedback.findOne({survey_response_id: response.id, scene_id: scene.id});

        if (feedback){
            feedback.skipped = true;
            await req.models.scene_feedback.update(feedback.id, feedback);
        } else {
            await req.models.scene_feedback.create({
                survey_response_id: response.id,
                scene_id:scene.id,
                skipped: true
            });
        }
        res.json({success:true});

    } catch(err){
        res.json({success:false, error:err.message})
    }
}

async function addSceneApi(req, res){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    const sceneId = req.params.sceneId;
    try {
        if (!req.campaign.display_schedule){
            throw new Error('Schedule not enabled on this campaign')
        }

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        if (event.end_time > new Date()){
            throw new Error('Event has not ended yet');
        }
        const attendance = await req.models.attendance.get(attendanceId);

        if (!attendance || attendance.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        const user = await req.models.user.get(event.campaign_id, req.session.activeUser.id);
        if (!user){
            throw new Error('Invalid User');
        }

        const scene = await req.models.scene.get(sceneId);
        if (!scene || scene.campaign_id !== req.campaign.id || scene.event_id !== event.id || scene.status !== 'confirmed'){
            throw new Error('Invalid Scene');
        }

        const response = await getResponse(req, event, attendance);
        if (response.submitted){
            throw new Error ('Response already submitted');
        }

        const feedback = await req.models.scene_feedback.findOne({survey_response_id: response.id, scene_id: scene.id});
        if (feedback){
            feedback.skipped = false;
            await req.models.scene_feedback.update(feedback.id, feedback);
        } else {
            if (scene.users.confirmed || !_.findWhere(scene.users.confirmed, {id:user.id})){
                await req.models.scene_feedback.create({
                    survey_response_id: response.id,
                    scene_id:scene.id,
                    skipped: false
                });
            }
        }
        res.json({success:true});

    } catch(err){
        res.json({success:false, error:err.message})
    }
}

async function addSceneFeedback(req, res){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    const sceneId = req.params.sceneId;
    const scene_feedback = req.body.scene_feedback;
    try {
        if (!req.campaign.display_schedule){
            throw new Error('Schedule not enabled on this campaign')
        }

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        if (event.end_time > new Date()){
            throw new Error('Event has not ended yet');
        }
        const attendance = await req.models.attendance.get(attendanceId);

        if (!attendance || attendance.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        const user = await req.models.user.get(event.campaign_id, req.session.activeUser.id);
        if (!user){
            throw new Error('Invalid User');
        }

        const scene = await req.models.scene.get(sceneId);
        if (!scene || scene.campaign_id !== req.campaign.id || scene.event_id !== event.id || scene.status !== 'confirmed'){
            throw new Error('Invalid Scene');
        }

        const response = await getResponse(req, event, attendance);
        if (response.submitted){
            throw new Error ('Response already submitted');
        }

        scene_feedback.survey_response_id = response.id;
        scene_feedback.scene_id = scene.id;
        scene_feedback.skipped = false;
        const current = await req.models.scene_feedback.findOne({survey_response_id:response.id, scnee_id:scene.id});
        if (current){
            await req.models.scene_feedback.update(current.id, scene_feedback);
        } else {
            await req.models.scene_feedback.create(scene_feedback);
        }
        res.json({success:true});
    } catch(err){
        res.json({success:false, error:err.message})
    }
}

async function updateSceneFeedback(req, res){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    const sceneId = req.params.sceneId;
    const feedbackId = req.params.feedbackId;
    const scene_feedback = req.body.scene_feedback;
    try {
        if (!req.campaign.display_schedule){
            throw new Error('Schedule not enabled on this campaign')
        }

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        if (event.end_time > new Date()){
            throw new Error('Event has not ended yet');
        }
        const attendance = await req.models.attendance.get(attendanceId);

        if (!attendance || attendance.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        const user = await req.models.user.get(event.campaign_id, req.session.activeUser.id);
        if (!user){
            throw new Error('Invalid User');
        }

        const scene = await req.models.scene.get(sceneId);
        if (!scene || scene.campaign_id !== req.campaign.id || scene.event_id !== event.id || scene.status !== 'confirmed'){
            throw new Error('Invalid Scene');
        }

        const response = await getResponse(req, event, attendance);
        if (response.submitted){
            throw new Error ('Response already submitted');
        }

        const current = await req.models.scene_feedback.get(feedbackId);
        if (!current){
            throw new Error ('Invalid Scene Feedback');
        }

        scene_feedback.survey_response_id = response.id;
        scene_feedback.scene_id = scene.id;
        scene_feedback.skipped = false;
        await req.models.scene_feedback.update(feedbackId, scene_feedback);

        res.json({success:true});
    } catch(err){
        res.json({success:false, error:err.message})
    }
}
async function getResponse(req, event, attendance){
    if (attendance.post_event_survey_response_id){
        return req.models.survey_response.get(attendance.post_event_survey_response_id)

    } else {
        const surveyResult = {
            campaign_id: event.campaign_id,
            user_id: attendance.user_id,
            event_id: event.id,
            submitted:false,
            survey_id: event.post_event_survey_id,
            survey_definition: JSON.stringify(event.post_event_survey.definition),
            updated: new Date(),
            data:{}
        };

        const surveyResponseId = await req.models.survey_response.create(surveyResult);
        await req.models.attendance.update(attendance.id, {post_event_survey_response_id:surveyResponseId});
        return getResponse(req, event, attendance);
    }
}

export default {
    show: showPostEventSurvey,
    showAddendum: showAddendum,
    submit: submitPostEventSurvey,
    submitAddendum: submitAddendum,
    saveApi: savePostEventSurveyApi,
    saveAddendumApi: saveAddendumApi,
    export: exportPostEventSurveys,
    exportScene: exportPostEventSceneSurveys,
    getUserSchedule,
    getSceneApi,
    removeSceneApi,
    addSceneApi,
    addSceneFeedback,
    updateSceneFeedback
}
