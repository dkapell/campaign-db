import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import permission from '../lib/permission';
import campaignHelper from '../lib/campaignHelper';
import surveyHelper from '../lib/surveyHelper';

async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Post Event Surveys'
    };
    try {
        res.locals.csrfToken = req.csrfToken();
        res.locals.title += ' - Post Event Surveys';
        const events:EventData[] = await req.models.event.find({campaign_id:req.campaign.id, deleted:false});
        const pastEvents = events.filter( (event) => { return event.end_time <= new Date(); })
        res.locals.events = pastEvents;
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;
        if ((user.type === 'player'  || user.type === 'event staff' ) && ! req.session.admin_mode){
            res.locals.my_post_event_surveys = await campaignHelper.getPostEventSurveys(user.id, pastEvents);
        } else {
            res.locals.my_post_event_surveys = await campaignHelper.getPostEventSurveys(user.id, pastEvents);
            const attendances = await req.models.attendance.find({campaign_id:req.campaign.id, post_event_submitted:true})
            res.locals.post_event_surveys = attendances.filter(attendance => {
                const event = _.findWhere(events, {id:attendance.event_id});
                if (!event) { return false; }

                const visibleAt = new Date(event.end_time);
                visibleAt.setDate(visibleAt.getDate() + req.campaign.post_event_survey_hide_days);
                if (visibleAt > new Date()){
                    return false;
                }
                return true;
            }).map((attendance) => {
                const event = _.findWhere(events, {id:attendance.event_id});
                return surveyHelper.formatPostEventData(attendance, event);
            });
        }
        res.render('post_event_survey/list', {pageTitle:'Post Event Surveys'});
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const attendanceId = req.params.id;
    try{
        const attendance = await req.models.attendance.get(attendanceId);
        if (!attendance || attendance.campaign_id !== req.campaign.id){
            throw new Error('Invalid Attendance');
        }
        if (!attendance.post_event_submitted){
            req.flash('warning', 'That survey has not been submited yet.')
            return res.redirect('/post_event_survey');
        }
        const event = await req.models.event.get(attendance.event_id);
        const visibleAt = new Date(event.end_time);
        visibleAt.setDate(visibleAt.getDate() + req.campaign.post_event_survey_hide_days);

        if (visibleAt > new Date()){
            req.flash('warning', 'You may not view that survey yet.')
            return res.redirect('/post_event_survey');
        }
        res.locals.event = event;
        res.locals.attendance = attendance;
        if (req.query.backto && req.query.backto === 'event'){
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/event', name: 'Events'},
                    { url: `/event/${event.id}`, name: event.name},
                ],
                current: `Post Event Survey: ${attendance.user.name}`
            }
            res.locals.backto = `/event/${event.id}`;
        } else {
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/post_event_survey', name: 'Post Event Surveys'},
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
