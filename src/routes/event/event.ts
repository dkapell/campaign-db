import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import async from 'async';
import permission from '../../lib/permission';
import Character from '../../lib/Character';
import characterRenderer from '../../lib/renderer/character';
import campaignHelper from '../../lib/campaignHelper';
import surveyHelper from '../../lib/surveyHelper';

import postEventSurveyRoutes from './post_event_survey';
import attendanceRoutes from './attendance';
import checkinRoutes from './checkin';

/* GET events listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Events'
    };
    try {
        res.locals.events = await req.models.event.find({campaign_id:req.campaign.id, deleted:false});
        res.locals.title += ' - Events';
        res.render('event/list', { pageTitle: 'Events' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const event = await req.models.event.get(id);
        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Events'},
            ],
            current: event.name
        };
        const campaign_users = await req.models.campaign_user.find({campaign_id:req.campaign.id});
        let users = await async.map(campaign_users, async (campaign_user) => {
            return req.models.user.get(req.campaign.id, campaign_user.user_id);
        });

        if (res.locals.checkPermission('contrib')){

            res.locals.post_event_surveys = event.attendees.filter(attendance => {
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
                return surveyHelper.formatPostEventData(attendance, event);
            });
        } else {
            res.locals.post_event_surveys = [];
        }

        users = users.filter(user => {return user.type !== 'none'});
        res.locals.users = _.sortBy(users, 'typeForDisplay');
        res.locals.csrfToken = req.csrfToken();
        res.locals.event = event;
        res.locals.title += ` - Event - ${event.name}`;
        res.render('event/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        if (req.query.clone){
            let event = await req.models.event.get(req.query.clone);
            if (!event || event.campaign_id !== req.campaign.id){
                throw new Error('Invalid Event');
            }
            delete event.id;
            for (const addon of event.addons){
                addon.id = 'new';
            }
            res.locals.clone = event.name;
            event.name += ' (copy)';
            event.registration_open = false;
            event = await fillEventTimes(req.campaign.id, event);
            res.locals.event = event;
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/event', name: 'Events'},
                ],
                current: `Clone - ${event.name}`
            };

        } else {
            res.locals.event = {
                name: null,
                description: null,
                start_date: null,
                start_hour: 22,
                end_date: null,
                end_hour: 14,
                registration_open: false,
                cost: req.campaign.event_default_cost?req.campaign.event_default_cost:0,
                location: req.campaign.event_default_location?req.campaign.event_default_location:null,
                hide_attendees: false,
                post_event_survey_deadline_date: null,
                post_event_survey_deadline_hour: 0,
                pre_event_survey_id: (await req.models.survey.findOne({campaign_id:req.campaign.id, type:'registration', default:true})).id,
                post_event_survey_id: (await req.models.survey.findOne({campaign_id:req.campaign.id, type:'post event', default:true})).id,
                addons: []

            };
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/event', name: 'Events'},
                ],
                current: 'New'
            };
        }

        res.locals.csrfToken = req.csrfToken();

        res.locals.surveys = await async.parallel({
            pre: async function(){
                return req.models.survey.find({campaign_id:req.campaign.id, type:'registration'});
            },
            post: async function(){
                return req.models.survey.find({campaign_id:req.campaign.id, type:'post event'});
            }
        });

        if (_.has(req.session, 'eventData')){
            res.locals.event = req.session.eventData;
            delete req.session.eventData;
        }
        res.locals.title += ' - New Event';
        res.render('event/new');
    } catch (err){
        next(err);
    }
}



async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        let event = await req.models.event.get(id);
        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        event = await fillEventTimes(req.campaign.id, event);

        res.locals.event = event;

        res.locals.surveys = await async.parallel({
            pre: async function(){
                return req.models.survey.find({campaign_id:req.campaign.id, type:'registration'});
            },
            post: async function(){
                return req.models.survey.find({campaign_id:req.campaign.id, type:'post event'});
            }
        });

        if (_.has(req.session, 'eventData')){
            res.locals.event = req.session.eventData;
            delete req.session.eventData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Events'},
            ],
            current: 'Edit: ' + event.name
        };
        if (req.query.backto === 'event'){
            res.locals.backto = 'event';
        } else {
            res.locals.backto = 'list';
        }
        res.locals.title += ` - Edit Event - ${event.name}`;
        res.render('event/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const event = req.body.event;

    req.session.eventData = event;

    for (const field of ['registration_open', 'hide_attendees']){
        if (!_.has(event, field)){
            event[field] = false;
        }
    }

    if (!_.has(event, 'cost') || event.cost === ''){
        event.cost = 0
    }

    if (event.pre_event_survey_id === '' || Number(event.pre_event_survey_id) === -1){
        event.pre_event_survey_id = null;
    }
    if (event.post_event_survey_id === '' || Number(event.post_event_survey_id) === -1){
        event.post_event_survey_id = null;
    }

    event.addons = parseEventAddons(event.addons);

    try{
        event.campaign_id = req.campaign.id;
        event.start_time = await campaignHelper.parseTime(req.campaign.id, event.start_date, Number(event.start_hour));
        event.end_time = await campaignHelper.parseTime(req.campaign.id, event.end_date, Number(event.end_hour));
        event.post_event_survey_deadline = await campaignHelper.parseTime(req.campaign.id, event.post_event_survey_deadline_date, Number(event.post_event_survey_deadline_hour));

        const id = await req.models.event.create(event);
        await req.audit('event', id, 'create', {new:event});
        delete req.session.eventData;
        req.flash('success', 'Created Event ' + event.name);
        res.redirect('/event');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/event/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const event = req.body.event;
    req.session.eventData = event;

    for (const field of ['registration_open', 'hide_attendees']){
        if (!_.has(event, field)){
            event[field] = false;
        }
    }

    if (!_.has(event, 'cost') || event.cost === ''){
        event.cost = 0
    }
    if (event.pre_event_survey_id === '' || Number(event.pre_event_survey_id) === -1){
        event.pre_event_survey_id = null;
    }
    if (event.post_event_survey_id === '' || Number(event.post_event_survey_id) === -1){
        event.post_event_survey_id = null;
    }

    event.addons = parseEventAddons(event.addons);

    try {
        const current = await req.models.event.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        if (current.deleted){
            throw new Error('Can not edit deleted record');
        }

        event.campaign_id = current.campaign_id;
        event.start_time = await campaignHelper.parseTime(req.campaign.id, event.start_date, Number(event.start_hour));
        event.end_time = await campaignHelper.parseTime(req.campaign.id, event.end_date, Number(event.end_hour));
        event.post_event_survey_deadline = await campaignHelper.parseTime(req.campaign.id, event.post_event_survey_deadline_date, Number(event.post_event_survey_deadline_hour));

        await req.models.event.update(id, event);
        await req.audit('event', id, 'update', {old: current, new:event});
        delete req.session.eventData;
        req.flash('success', 'Updated Event ' + event.name);
        if (req.body.backto === 'event'){
            res.redirect(`/event/${event.id}`);
        } else {
            res.redirect('/event');
        }
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/event/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.event.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        current.deleted = true;
        await req.models.event.update(id, current);
        await req.audit('event', id, 'delete', {old: current});
        req.flash('success', 'Removed Event');
        res.redirect('/event');
    } catch(err) {
        return next(err);
    }
}


async function exportPlayerPdfs(req, res, next){
    const eventId = req.params.id;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        const players = event.players.filter(player => { return player.attending });
        const characters = await async.map(players, async(player) => {
            const character = new Character({id:player.character_id});
            await character.init();
            return character.data();
        });

        const charactersSorted = characters.sort(campaignHelper.characterSorter);

        const pdf = await characterRenderer(charactersSorted, {
            skillDescriptions: req.query.descriptions,
            showLanguages: req.query.languages,
            showRules: req.query.rules
        });

        pdf.pipe(res);
        res.set('Content-Type', 'application/pdf');
        res.attachment(`${event.name} - All Player Sheets.pdf`);
        pdf.end();
    } catch (err){
        return next(err);
    }
}

async function grantAttendanceCp(req, res){
    const eventId = req.params.id;
    try {
        const event = await req.models.event.get(eventId);
        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        if (!req.campaign.event_attendance_cp){
            return res.json({success:true});
        }
        let count = 0;
        for (const attendee of event.attendees){
            if (!attendee.checked_in) { continue; }
            if (attendee.attendance_cp_granted) { continue; }

            console.log(`adding CP to ${attendee.user.name}`);
            await req.models.cp_grant.create({
                campaign_id: req.campaign.id,
                user_id: attendee.user_id,
                content: `Attendance for ${event.name}`,
                amount: req.campaign.event_attendance_cp,
                status: 'approved'
            });
            await req.models.attendance.update(attendee.id, {attendance_cp_granted:true});
            count++;
        }
        if (count){
            req.flash('success', `Assigned ${req.campaign.event_attendance_cp} Event CP to ${count} checked in player(s) who had not already received it.`);
        } else {
            req.flash('success', `No Players in need of Event CP assignment.`);
        }
        return res.json({success:true});
    } catch(err) {
        res.json({success:false, error:err.message});
    }
}

function parseEventAddons(input){
    const output = [];

    for (const id in input){
        if (id === 'new'){
            continue;
        }

        const addon = input[id];
        for (const field of ['available_to_player', 'available_to_staff', 'charge_player', 'charge_staff', 'on_checkin']){
            if (!_.has(addon, field)){
                addon[field] = false;
            }
        }

        output.push(input[id]);
    }
    return output;
}

async function fillEventTimes(campaignId, event){
    const start_times = await campaignHelper.splitTime(campaignId, event.start_time);
    event.start_date = start_times.date;
    event.start_hour = start_times.hour;
    const end_times = await campaignHelper.splitTime(campaignId, event.end_time);
    event.end_date = end_times.date;
    event.end_hour = end_times.hour;
    const post_event_survey_deadline_times = await campaignHelper.splitTime(campaignId, event.post_event_survey_deadline);
    event.post_event_survey_deadline_date = post_event_survey_deadline_times.date;
    event.post_event_survey_deadline_hour = post_event_survey_deadline_times.hour;
    return event;
}

const router = express.Router();

router.use(permission('player'));
router.use(function(req, res, next){
    res.locals.siteSection='event';
    next();
});

router.get('/', list);
router.get('/new', csrf(), permission('gm'), showNew);
router.get('/:id', csrf(), show);
router.get('/:id/edit', csrf(), permission('gm'), showEdit);
router.get('/:id/export', csrf(), permission('contrib, registration view'), attendanceRoutes.export);
router.get('/:id/export_survey', csrf(), permission('contrib'), postEventSurveyRoutes.export);
router.get('/:id/pdf', csrf(), permission('contrib'), exportPlayerPdfs);
router.post('/', csrf(), permission('gm'), create);
router.put('/:id', csrf(), permission('gm'), update);
router.delete('/:id', permission('admin'), remove);
router.put('/:id/grant_cp', csrf(), permission('gm'), grantAttendanceCp);

router.get('/:id/checkin', csrf(), permission('contrib, registration view'), checkinRoutes.show);
router.post('/:id/checkin/:attendanceId', csrf(), permission('contrib, registration edit'), checkinRoutes.checkin);
router.post('/:id/uncheckin/:attendanceId', csrf(), permission('contrib, registration edit'), checkinRoutes.uncheckin);

router.get('/:id/register', csrf(), attendanceRoutes.showNew);
router.post('/:id/register', csrf(), attendanceRoutes.create);
router.post('/:id/not_attending', csrf(), attendanceRoutes.createNot);
router.get('/:id/register/:attendanceId', csrf(), attendanceRoutes.showEdit);
router.put('/:id/register/:attendanceId', csrf(), attendanceRoutes.update);
router.delete('/:id/register/:attendanceId', csrf(), attendanceRoutes.remove);

router.get('/:id/post_event/', csrf(), postEventSurveyRoutes.show);
router.get('/:id/post_event/:attendanceId', csrf(), postEventSurveyRoutes.show);
router.get('/:id/post_event/:attendanceId/addendum', csrf(), postEventSurveyRoutes.showAddendum);
router.put('/:id/post_event/:attendanceId', csrf(), postEventSurveyRoutes.submit);
router.put('/:id/post_event/:attendanceId/api', csrf(), postEventSurveyRoutes.saveApi);
router.put('/:id/post_event/:attendanceId/addendum', csrf(), postEventSurveyRoutes.submitAddendum);
router.put('/:id/post_event/:attendanceId/addendum/api', csrf(), postEventSurveyRoutes.saveAddendumApi);

export default router;
