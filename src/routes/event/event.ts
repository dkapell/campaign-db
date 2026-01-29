import express from 'express';
import _ from 'underscore';
import async from 'async';
import permission from '../../lib/permission';
import Character from '../../lib/Character';
import characterRenderer from '../../lib/renderer/character';
import campaignHelper from '../../lib/campaignHelper';
import surveyHelper from '../../lib/surveyHelper';
import orderHelper from '../../lib/orderHelper';
import scheduleHelper from '../../lib/scheduleHelper';

import postEventSurveyRoutes from './post_event_survey';
import attendanceRoutes from './attendance';
import checkinRoutes from './checkin';
import scheduleRoutes from './schedule';

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
        res.render('event/list');
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

        res.locals.scheduleVisible = await req.isScheduleVisible(event.id) && event.schedule_status !== 'private';

        if ((req.checkPermission('event') && event.schedule_status !== 'private') ||
            (req.checkPermission('player') && event.schedule_status === 'player visible')){
            res.locals.schedule = await scheduleHelper.getUserSchedule(event.id, req.session.activeUser.id, req.session.activeUser.type==='player');
        }

        if (req.checkPermission('contrib')){

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
                return surveyHelper.formatPostEventModel(attendance, event);
            });
            res.locals.schedule_reports = _.pluck(await req.models.schedule_report.find({campaign_id:req.campaign.id}), 'name');
        } else {
            res.locals.post_event_surveys = [];
        }

        if (req.checkPermission('gm, orders view')) {
            res.locals.income = {
                event: {
                    count: 0,
                    price: event.default_cost,
                    raw: 0,
                    orders: 0,
                    outstanding: 0
                },
                addons: {
                    total: {
                        raw: 0,
                        orders: 0,
                        outstanding: 0
                    },
                    addons: {}
                }

            };
            for (const attendance of event.attendees) {
                if (!attendance.attending){ continue; }
                if (attendance.paid) {
                    res.locals.income.event.raw += attendance.cost;
                    res.locals.income.event.count++;
                    if (req.campaign.stripe_account_ready && await orderHelper.isPaid('attendance', attendance.id)) {
                        res.locals.income.event.orders += attendance.cost;
                    }
                } else if (attendance.user.type === 'player') {
                    res.locals.income.event.outstanding += attendance.cost;
                    res.locals.income.event.count++;
                }

                for (const attendance_addon of attendance.addons) {
                    const addonName = attendance_addon.addon.name;
                    const cost = attendance_addon.addon.pay_what_you_want&&!_.isNull(attendance_addon.cost)?attendance_addon.cost:attendance_addon.addon.cost;

                    if (attendance_addon.addon.charge_player || attendance_addon.addon.charge_staff){
                        if (!_.has(res.locals.income.addons.addons, addonName)){
                            res.locals.income.addons.addons[addonName] = {
                                count: 0,
                                price: cost,
                                raw: 0,
                                orders: 0,
                                outstanding: 0
                            };
                        }
                    }
                    if (attendance_addon.paid) {
                        res.locals.income.addons.total.raw += cost;
                        res.locals.income.addons.addons[addonName].raw += cost;
                        res.locals.income.addons.addons[addonName].count++;
                        if (req.campaign.stripe_account_ready && await orderHelper.isPaid('attendance_addon', attendance_addon.id)) {
                            res.locals.income.addons.total.orders += cost;
                            res.locals.income.addons.addons[addonName].orders += cost;
                        }
                    } else if (attendance.user.type === 'player' && attendance_addon.addon.charge_player){
                        res.locals.income.addons.total.outstanding += cost;
                        res.locals.income.addons.addons[addonName].outstanding += cost;
                        res.locals.income.addons.addons[addonName].count++;
                    } else if (attendance.user.type !== 'player' && attendance_addon.addon.charge_staff){
                        res.locals.income.addons.total.outstanding += cost;
                        res.locals.income.addons.addons[addonName].outstanding += cost;
                        res.locals.income.addons.addons[addonName].count++;
                    }

                }
            }
        }

        users = users.filter(user => {return user.type !== 'none'});
        res.locals.users = _.sortBy(users, 'typeForDisplay');
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
                costs: [
                    {name: 'Default', cost: req.campaign.event_default_cost?req.campaign.event_default_cost:0}
                ],
                location: req.campaign.event_default_location?req.campaign.event_default_location:null,
                hide_attendees: false,
                post_event_survey_deadline_date: null,
                post_event_survey_deadline_hour: 0,
                pre_event_survey_id: null,
                post_event_survey_id: null,
                addons: [],
                schedule_status: 'private'
            };

            const preEventSurvey = await req.models.survey.findOne({ campaign_id: req.campaign.id, type: 'registration', default: true });
            if (preEventSurvey){
                res.locals.event.pre_event_survey_id = preEventSurvey.id;
            }
            const postEventSurvey = await req.models.survey.findOne({ campaign_id: req.campaign.id, type: 'post event', default: true });
            if (postEventSurvey){
                res.locals.event.post_event_survey_id = postEventSurvey.id;
            }

            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/event', name: 'Events'},
                ],
                current: 'New'
            };
        }

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


    if (event.cost){
        event.costs = [
            {
                name: 'Default',
                cost: event.cost?Number(event.cost):0,
                default:true
            }
        ]
    } else {
        event.costs = parseEventCosts(event.costs);
    }


    for (const field of ['registration_open', 'hide_attendees']){
        if (!_.has(event, field)){
            event[field] = false;
        }
    }

    if (event.pre_event_survey_id === '' || Number(event.pre_event_survey_id) === -1){
        event.pre_event_survey_id = null;
    }
    if (event.post_event_survey_id === '' || Number(event.post_event_survey_id) === -1){
        event.post_event_survey_id = null;
    }

    event.addons = parseEventAddons(event.addons);

    req.session.eventData = event;

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

    for (const field of ['registration_open', 'hide_attendees']){
        if (!_.has(event, field)){
            event[field] = false;
        }
    }
    if (event.cost){
        event.costs = [
            {
                name: 'Default',
                cost: event.cost?Number(event.cost):0,
                default:true
            }
        ]
    } else {
        event.costs = parseEventCosts(event.costs);
    }


    if (event.pre_event_survey_id === '' || Number(event.pre_event_survey_id) === -1){
        event.pre_event_survey_id = null;
    }
    if (event.post_event_survey_id === '' || Number(event.post_event_survey_id) === -1){
        event.post_event_survey_id = null;
    }

    event.addons = parseEventAddons(event.addons);
    req.session.eventData = event;


    console.log(JSON.stringify(event, null, 2));

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
            if (attendee.user.type !== 'player') { continue; }

            console.log(`adding ${req.campaign.renames.cp.singular} to ${attendee.user.name}`);
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
            req.flash('success', `Assigned ${req.campaign.event_attendance_cp} Event ${req.campaign.renames.cp.singular} to ${count} checked in player(s) who had not already received it.`);
        } else {
            req.flash('success', `No Players in need of Event ${req.campaign.renames.cp.singular} assignment.`);
        }
        return res.json({success:true});
    } catch(err) {
        res.json({success:false, error:err.message});
    }
}

async function checkoutEvent(req, res){
    const id = req.params.id;
    if (!req.campaign.stripe_account_ready){
        req.flash('info', 'Orders are not enabled for this Campaign');
        return res.redirect(`/event/${id}`);
    }
    try{
        const event = await req.models.event.get(id);
        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        const attendance = await req.models.attendance.findOne({event_id:id, user_id:req.session.activeUser.id});
        if (!attendance){
            req.flash('error', 'Not Registered for this Event');
            return res.redirect(`/event/${id}`);
        }
        const items = [];

        if (attendance.cost && !attendance.paid && attendance.user.type === 'player'){
            items.push({
                type: 'attendance',
                id: attendance.id,
                name: `Event Registration: ${event.name}`,
                cost: attendance.cost * 100
            });
        }

        for ( const addon of attendance.addons ){
            const event_addon = _.findWhere(event.addons, {id:addon.event_addon_id})
            if (!addon.paid){
                if (event_addon.charge_player && attendance.user.type === 'player' || event_addon.charge_staff && attendance.user.type !== 'player'){
                    const cost = event_addon.pay_what_you_want && !_.isNull(addon.cost)?addon.cost:event_addon.cost;
                    items.push({
                        type:'attendance_addon',
                        id: addon.id,
                        name: `Addon for ${event.name}: ${event_addon.name}`,
                        cost: cost * 100
                    });

                }
            }
        }
        if (!items.length){
            req.flash('success', 'No outstanding balance');
            return res.redirect(`/event/${id}`);
        }
        await orderHelper.emptyOrder(req.campaign.id, req.session.activeUser.id);
        await orderHelper.addItemsToOrder(req.campaign.id, req.session.activeUser.id, items);
        res.redirect(`/order/checkout?back=/event/${id}`);
    } catch (err){
        console.trace(err)
        req.flash('error', 'Payment Error: ' + err.message);
        res.redirect(`/event/${id}`);
    }
}

function parseEventAddons(input){
    const output = [];

    for (const id in input){
        if (id === 'new'){
            continue;
        }

        const addon = input[id];
        if (addon.minimum === ''){
            addon.minimum = 0;
        }
        for (const field of ['available_to_player', 'available_to_staff', 'charge_player', 'charge_staff', 'on_checkin', 'pay_what_you_want']){
            if (!_.has(addon, field)){
                addon[field] = false;
            }
        }

        output.push(input[id]);
    }
    return output;
}

function parseEventCosts(input){
    const output = [];
    for (const id in input){
        if (id === 'new'){
            continue;
        }

        const cost = input[id];
        if (cost.minimum === ''){
            cost.minimum = 0;
        }
        for (const field of ['default', 'pay_what_you_want']){
            if (!_.has(cost, field)){
                cost[field] = false;
            }
        }
        cost.minimum = Number(cost.minimum);
        cost.cost = Number(cost.cost);
        cost.default = !!cost.default;
        cost.pay_what_you_want = !!cost.pay_what_you_want;

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
    res.locals.siteSection='events';
    next();
});
router.use(scheduleHelper.middleware);

router.get('/', list);
router.get('/new', permission('gm'), showNew);
router.get('/:id', show);
router.get('/:id/edit', permission('gm'), showEdit);
router.get('/:id/export', permission('contrib, registration view'), attendanceRoutes.export);
router.get('/:id/export_survey', permission('contrib'), postEventSurveyRoutes.export);
router.get('/:id/export_survey_scene', permission('gm'), postEventSurveyRoutes.exportScene);
router.get('/:id/pdf', permission('contrib'), exportPlayerPdfs);
router.get('/:id/checkout', checkoutEvent);
router.post('/', permission('gm'), create);
router.put('/:id', permission('gm'), update);
router.delete('/:id', permission('admin'), remove);
router.put('/:id/grant_cp', permission('gm'), grantAttendanceCp);

router.get('/:id/checkin', permission('contrib, registration view'), checkinRoutes.show);
router.post('/:id/checkin/:attendanceId', permission('contrib, checkin edit'), checkinRoutes.checkin);
router.post('/:id/uncheckin/:attendanceId', permission('contrib, checkin edit'), checkinRoutes.uncheckin);

router.get('/:id/register', attendanceRoutes.showNew);
router.post('/:id/register', attendanceRoutes.create);
router.post('/:id/not_attending', attendanceRoutes.createNot);
router.get('/:id/register/:attendanceId', attendanceRoutes.showEdit);
router.put('/:id/register/:attendanceId', attendanceRoutes.update);
router.delete('/:id/register/:attendanceId', attendanceRoutes.remove);

router.get('/:id/post_event/', postEventSurveyRoutes.show);
router.get('/:id/post_event/:attendanceId', postEventSurveyRoutes.show);
router.get('/:id/post_event/:attendanceId/addendum', postEventSurveyRoutes.showAddendum);
router.put('/:id/post_event/:attendanceId', postEventSurveyRoutes.submit);
router.put('/:id/post_event/:attendanceId/api', postEventSurveyRoutes.saveApi);
router.put('/:id/post_event/:attendanceId/addendum', postEventSurveyRoutes.submitAddendum);
router.put('/:id/post_event/:attendanceId/addendum/api', postEventSurveyRoutes.saveAddendumApi);

router.use(function(req, res, next){
    if (!req.campaign.display_schedule){
        req.flash('error', 'Event Schedules are not active on this campaign')
        return res.redirect('/');
    }
    next();
});

router.get('/:id/post_event/:attendanceId/schedule', postEventSurveyRoutes.getUserSchedule);
router.get('/:id/post_event/:attendanceId/:sceneId', postEventSurveyRoutes.getSceneApi);
router.post('/:id/post_event/:attendanceId/:sceneId', postEventSurveyRoutes.addSceneApi);
router.delete('/:id/post_event/:attendanceId/:sceneId', postEventSurveyRoutes.removeSceneApi);
router.post('/:id/post_event/:attendanceId/:sceneId/feedback', postEventSurveyRoutes.addSceneFeedback);
router.put('/:id/post_event/:attendanceId/:sceneId/feedback/:feedbackId', postEventSurveyRoutes.updateSceneFeedback);

router.get('/:id/scheduler', permission('gm'), scheduleRoutes.showScheduler);
router.get('/:id/schedule', scheduleRoutes.showSchedule);
router.get('/:id/schedules', permission('gm'), scheduleRoutes.listScheduleSnapshots);
router.get('/:id/schedule/export', scheduleRoutes.exportSchedule);
router.get('/:id/schedule/report/:name', permission('contrib'), scheduleRoutes.getReport);
router.get('/:id/scene/validate', permission('contrib'), scheduleRoutes.validateScenes);
router.get('/:id/timeslot', permission('contrib'), scheduleRoutes.getUsersPerTimeslot);
router.get('/:id/timeslot/:timeslotId', permission('contrib'), scheduleRoutes.getUsersAtTimeslot);
router.get('/:id/timeslot/:timeslotId/busy', permission('contrib'), scheduleRoutes.getBusyUsersAtTimeslot);
router.get('/:id/user/:userId/schedule', scheduleRoutes.getUserSchedule);
router.put('/:id/scheduler', permission('admin, scheduler'), scheduleRoutes.runScheduler);
router.put('/:id/scheduler/clear', permission('admin, scheduler'), scheduleRoutes.clearSchedule);
router.put('/:id/schedule/:scheduleId/keep', permission('admin, scheduler'), scheduleRoutes.keepScheduleSnapshot);
router.put('/:id/schedule/:scheduleId/unkeep', permission('admin, scheduler'), scheduleRoutes.unkeepScheduleSnapshot);
router.put('/:id/schedule/:scheduleId/restore', permission('admin, scheduler'), scheduleRoutes.restoreScheduleSnapshot);
router.put('/:id/scene/:sceneId', permission('admin, scheduler'), scheduleRoutes.updateScene);
router.put('/:id/scene/:sceneId/confirm', permission('admin, scheduler'), scheduleRoutes.confirmScene);
router.put('/:id/scene/:sceneId/users/confirm/:type', permission('admin, scheduler'), scheduleRoutes.confirmSceneUsers);
router.put('/:id/scene/:sceneId/users/unconfirm/:type', permission('admin, scheduler'), scheduleRoutes.unconfirmSceneUsers);
router.put('/:id/scene/:sceneId/unconfirm', permission('admin, scheduler'), scheduleRoutes.unconfirmScene);
router.put('/:id/user/:userId', permission('admin, scheduler'), scheduleRoutes.updateUser);
router.put('/:id/issue/:issueId/:status', permission('admin, scheduler'), scheduleRoutes.updateIssue);
router.post('/:id/schedule', permission('admin, scheduler'), scheduleRoutes.saveScheduleSnapshot);
router.delete('/:id/schedule/:scheduleId', permission('admin, scheduler'), scheduleRoutes.removeScheduleSnapshot);

export default router;
