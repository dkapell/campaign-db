import express from 'express';
import csrf from 'csurf';
import async from 'async';
import _ from 'underscore';
import permission from '../lib/permission';
import campaignHelper from '../lib/campaignHelper';
import surveyHelper from '../lib/surveyHelper';

async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: req.campaign.renames.post_event_survey.plural
    };
    try {
        res.locals.csrfToken = req.csrfToken();
        res.locals.title += ` - ${req.campaign.renames.post_event_survey.plural}`;
        const events:EventData[] = await req.models.event.find({campaign_id:req.campaign.id, deleted:false});
        const pastEvents = events.filter( (event) => { return event.end_time <= new Date(); })
        res.locals.events = pastEvents;
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;
        if ((user.type === 'player'  || user.type === 'event staff' ) && ! req.session.admin_mode){
            res.locals.my_post_event_surveys = await campaignHelper.getPostEventSurveys(user.id, pastEvents);
        } else {
            res.locals.my_post_event_surveys = await campaignHelper.getPostEventSurveys(user.id, pastEvents);
            const responses = [];
            const surveys = await req.models.survey.find({type: 'post event'});
            for (const survey of surveys){
                const surveyResponses = await req.models.survey_response.find({survey_id: survey.id, submitted:true});
                for (const response of surveyResponses){
                    const event = _.findWhere(events, {id:response.event_id});
                    const visibleAt = new Date(event.end_time);
                    visibleAt.setDate(visibleAt.getDate() + req.campaign.post_event_survey_hide_days);
                    if (visibleAt > new Date()){
                        continue;
                    }
                    responses.push(await surveyHelper.formatPostEventResponses(response, event));

                }
            }

            res.locals.post_event_surveys = responses;

            let addendums = await req.models.post_event_addendum.find({campaign_id:req.campaign.id, submitted:true});
            addendums = await async.map(addendums, async (addendum) => {
                addendum.type = 'addendum';
                addendum.user = await req.models.user.get(req.campaign.id, addendum.user_id);
                const attendance = await req.models.attendance.get(addendum.attendance_id);
                const event = _.findWhere(events, {id:attendance.event_id});
                addendum.eventName= event.name;
                addendum.eventStartTime= event.start_time;
                addendum.eventEndTime= event.end_time;
                addendum.submittedAt = new Date(addendum.submitted_at);
                addendum.attendanceId = addendum.attendance_id;
                return addendum;
            });

            res.locals.allItems = ([...responses, ...addendums]).sort((a, b) => {
                return b.submittedAt - a.submittedAt;
            });
        }
        res.render('post_event_survey/list', {pageTitle:req.campaign.renames.post_event_survey.plural});
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const attendanceId = req.params.id;
    try{
        let attendance = await req.models.attendance.get(attendanceId);
        if (!attendance || attendance.campaign_id !== req.campaign.id){
            throw new Error('Invalid Attendance');
        }

        const event = await req.models.event.get(attendance.event_id);
        attendance = await surveyHelper.fillAttendance(attendance, event);

        if (!attendance.post_event_submitted){
            req.flash('warning', 'That survey has not been submited yet.')
            return res.redirect('/post_event_survey');
        }

        const visibleAt = new Date(event.end_time);
        visibleAt.setDate(visibleAt.getDate() + req.campaign.post_event_survey_hide_days);

        if (visibleAt > new Date()){
            req.flash('warning', 'You may not view that survey yet.')
            return res.redirect('/post_event_survey');
        }
        res.locals.event = event;
        res.locals.attendance = await surveyHelper.fillAttendance(attendance, event);
        if (req.query.backto && req.query.backto === 'event'){
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/event', name: 'Events'},
                    { url: `/event/${event.id}`, name: event.name},
                ],
                current: `${req.campaign.renames.post_event_survey.singular}: ${attendance.user.name}`
            }
            res.locals.backto = `/event/${event.id}`;
        } else {
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/post_event_survey', name: req.campaign.renames.post_event_survey.plural},
                ],
                current: `${event.name}: ${attendance.user.name}`
            };
            res.locals.backto = `/post_event_survey`;
        }
        res.locals.csrfToken = req.csrfToken();
        res.render('post_event_survey/show');
    } catch (err){
        return next(err);
    }
}

const router = express.Router();

router.use(permission('player'));
router.use(function(req, res, next){
    const user = req.session.assumed_user ? req.session.assumed_user: (req.user as CampaignUser);
    if (user.type === 'player'){
        res.locals.siteSection='character';
    } else {
        res.locals.siteSection='gm';
    }
    next();
});

router.get('/', csrf(), list);
router.get('/:id', csrf(), permission('contrib'), show);


export default router;
