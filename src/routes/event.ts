import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import async from 'async';
import stringify from 'csv-stringify-as-promised';
import permission from '../lib/permission';
import Character from '../lib/Character';
import characterRenderer from '../lib/renderer/character';
import campaignHelper from '../lib/campaignHelper';
import surveyHelper from '../lib/surveyHelper';
import removeMd from 'remove-markdown';
import moment from 'moment';

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

async function showNewAttendance(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();
     try{
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;

        const event = await req.models.event.get(id);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        if (user.type.match(/^(core staff|admin)$/)){
            const campaign_users = await req.models.campaign_user.find({campaign_id:req.campaign.id});
            let users = await async.map(campaign_users, async (campaign_user) => {
                const user = await req.models.user.get(req.campaign.id, campaign_user.user_id);
                return user;
            });
            users = users.filter(user => { return user.type !== 'none'});
            res.locals.users = _.sortBy(users, 'typeForDisplay')
        } else {
            const attendance = await req.models.attendance.findOne({event_id:event.id, user_id:user.id});
            if (attendance){
                res.redirect(`/event/${event.id}/register/${attendance.id}`)
            }
        }
        res.locals.event = event;
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Events'},
                { url: `/event/${event.id}`, name: event.name},
            ],
            current: 'Register'
        };

        res.locals.characters = await req.models.character.find({campaign_id:req.campaign.id, user_id:user.id});
        const activeCharacter = _.findWhere(res.locals.characters, {active:true});

        res.locals.attendance = {
            character_id: activeCharacter?activeCharacter.id:null,
            paid: false,
            notes: null,
            pre_event_data: {},
            user_id: user.id

        };

        if (_.has(req.session, 'attendanceData')){
            res.locals.attendance = req.session.attendanceData;
            delete req.session.attendanceData;
        }

        //fix for gm scenartio
        res.locals.attendance.user = user;

        res.locals.title += ' - Register';
        res.render('event/attendance/new');
    } catch (err){
        next(err);
    }
}

async function showEditAttendance(req, res, next){

    const eventId = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const event = await req.models.event.get(eventId);
        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        const attendance = await req.models.attendance.get(req.params.attendanceId);
        if (!attendance || attendance.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        res.locals.event = event;

        if (!_.has(attendance, 'data') || ! attendance.data){
            attendance.data = {};
        }

        res.locals.attendance = attendance;

        if (_.has(req.session, 'attendanceData')){
            res.locals.attendance = req.session.attendanceData;
            delete req.session.attendanceData;
        }

        res.locals.attendance.user = await req.models.user.get(req.campaign.id,res.locals.attendance.user_id )


        const user = req.session.assumed_user ? req.session.assumed_user: req.user;

        if (!attendance.character_id){
            const characters = await req.models.character.find({campaign_id:req.campaign.id, user_id:user.id});
            const activeCharacter = _.findWhere(characters, {active:true});
            res.locals.attendance.character_id = activeCharacter?activeCharacter.id:null;
        }

        if (user.type.match(/^(core staff|admin)$/)) {
            const campaign_users = await req.models.campaign_user.find({campaign_id:req.campaign.id});
            let users = await async.map(campaign_users, async (campaign_user) => {
                const user = await req.models.user.get(req.campaign.id, campaign_user.user_id);
                return user;
            });
            users = users.filter(user => { return user.type !== 'none'});
            res.locals.users = _.sortBy(users, 'typeForDisplay')
        } else if ( attendance.user_id !== user.id && !res.locals.checkPermission('registration edit')){
            return res.redirect(`/event/${eventId}/register`);
        }

        res.locals.characters = await req.models.character.find({campaign_id:req.campaign.id, user_id:attendance.user_id});


        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Events'},
                { url: `/event/${event.id}`, name: event.name},
            ],
            current: 'Edit Registration'
        };
        res.locals.title += ` - Edit Registration`;
        res.render('event/attendance/edit');
    } catch(err){
        next(err);
    }

}

async function createAttendance(req, res){
    const eventId = req.params.id;
    const attendance = req.body.attendance;
    req.session.attendanceData = attendance;
    try {

        let user = req.session.assumed_user ? req.session.assumed_user: req.user;

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        attendance.event_id = eventId;

        if (user.type.match(/^(core staff|admin)$/)) {
            if (attendance.user_id) {
                user = await req.models.user.get(req.campaign.id, attendance.user_id);
            } else {
                attendance.user_id = user.id;
            }

            if (!_.has(attendance, 'paid')){
               attendance.paid = false;
            }


        } else {
            attendance.user_id = user.id;
        }


        const currentAttendance = await req.models.attendance.findOne({event_id:event.id, user_id:attendance.user_id});
        if (currentAttendance){
            if (currentAttendance.attending){
                req.flash('success', 'Already Registered');
                return res.redirect(`/event/${event.id}`)
            } else {
                await req.models.attendance.delete(currentAttendance.id);
            }
        }

        attendance.campaign_id = req.campaign.id;

        if (attendance.character_id === ''){
            attendance.character_id = null;
        }

        if (event.pre_event_survey){
            attendance.pre_event_data = surveyHelper.parseData(
                attendance.pre_event_data,
                event.pre_event_survey.definition,
                {},
                user.type
            );
        }
        attendance.attending = true;
        attendance.addons = parseAttendeeAddons(attendance.addons, res.locals.checkPermission('gm'));
        const id = await req.models.attendance.create(attendance);

        await req.audit('attendance', id, 'create', {new:attendance});
        delete req.session.attendanceData;
        req.flash('success', `Registered ${user.name} for ${event.name}`);
        res.redirect(`/event/${event.id}`);
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect(`/event/${eventId}/register`);
    }
}

async function markCheckedIn(req, res, next){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        const attendance = await req.models.attendance.get(attendanceId);

        if (!attendance || attendance.event_id !== event.id){
            throw new Error('Invalid Attendance');
        }

        await req.models.attendance.update(attendance.id, {checked_in:true})
        res.json({success:true, checked_in:true});
    } catch(err){
        return next(err);
    }

}

async function unmarkCheckedIn(req, res, next){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        const attendance = await req.models.attendance.get(attendanceId);

        if (!attendance || attendance.event_id !== event.id){
            throw new Error('Invalid Attendance');
        }

        await req.models.attendance.update(attendance.id, {checked_in:false})
        res.json({success:true, checked_in:false});
    } catch(err){
        return next(err);
    }

}

async function createNotAttendance(req, res){
    const eventId = req.params.id;
    const attendance = req.body.attendance;
    req.session.attendanceData = attendance;
    try {

        let user = req.session.assumed_user ? req.session.assumed_user: req.user;

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        attendance.event_id = eventId;

        if (user.type.match(/^(core staff|admin)$/)) {
            if (attendance.user_id) {
                user = await req.models.user.get(req.campaign.id, attendance.user_id);
            } else {
                attendance.user_id = user.id;
            }

            if (!_.has(attendance, 'paid')){
               attendance.paid = false;
            }

        } else {
            attendance.user_id = user.id;
        }

        const currentAttendance = await req.models.attendance.findOne({event_id:event.id, user_id:attendance.user_id});
        if (currentAttendance){
            if (currentAttendance.attending){
                req.flash('danger', 'Currently marked attending, unregister first');
                return res.redirect(`/event/${event.id}`)
            } else {
                req.flash('success', 'Already marked as not attending');
                return res.redirect(`/event/${event.id}`)
            }
        }

        attendance.campaign_id = req.campaign.id;
        attendance.character_id = null;
        attendance.attending = false;

        const id = await req.models.attendance.create(attendance);

        await req.audit('attendance', id, 'create', {new:attendance});
        delete req.session.attendanceData;
        req.flash('success', `Registered ${user.name} for ${event.name}`);
        res.redirect(`/event/${event.id}`);
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect(`/event/${eventId}/register`);
    }
}


async function updateAttendance(req, res){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    const attendance = req.body.attendance;
    req.session.attendanceData = attendance;

    try {
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;

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


        if (user.type.match(/^(core staff|admin)$/)){
            if (!_.has(attendance, 'paid')){
                attendance.paid = false
            }
        } else if (res.locals.checkPermission('registration edit')){
            delete attendance.paid;
            delete attendance.user_id;

        } else {
            if (current.user_id !== user.id){
                throw new Error('Not allowed to edit this registration');
            }
        }

        if (attendance.character_id === ''){
            attendance.character_id = null;
        }

        if (event.pre_event_survey){
            attendance.pre_event_data = surveyHelper.parseData(
                attendance.pre_event_data,
                event.pre_event_survey.definition,
                current.pre_event_data,
                user.type
            );

        }

        attendance.attending = true;

        attendance.addons = parseAttendeeAddons(attendance.addons, res.locals.checkPermission('gm'));
        attendance.campaign_id = current.campaign_id;

        await req.models.attendance.update(attendanceId, attendance);
        await req.audit('attendance', attendanceId, 'update', {old: current, new:attendance});
        delete req.session.attendanceData;
        req.flash('success', `Updated registration of ${current.user.name} for ${event.name}`);
        res.redirect(`/event/${event.id}`);
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/event/${eventId}/register/${attendanceId}`));

    }
}

async function removeAttendance(req, res, next){
    const eventId = req.params.id;
    const attendanceId = req.params.attendanceId;
    try {
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        const current = await req.models.attendance.get(attendanceId);

        if (!current || current.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        if (! user.type.match(/^(core staff|admin)$/) && current.user_id !== user.id){
            throw new Error('Not allowed to edit this registration');
        }

        await req.models.attendance.delete(attendanceId);
        await req.audit('attendance', attendanceId, 'delete', {old: current});
        req.flash('success', `Unregistered ${current.user.name} from ${event.name}`);
        res.redirect(`/event/${event.id}`);
    } catch(err) {
        return next(err);
    }
}

async function exportEventAttendees(req, res, next){
    const eventId = req.params.id;
    const exportType = req.query.type;
    try {
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }


        const output = [];
        const header = ['Name', 'Email'];
        if (exportType === 'player'){
            header.push('Character');
            if (event.cost){
                header.push('Paid');
            }
            if (event.addons.length){
                for (const addon of event.addons){
                    if (addon.available_to_player){
                        header.push(addon.name);
                    }
                }
            }
        } else {
            header.push('Type');
            if (event.addons.length){
                for (const addon of event.addons){
                    if (addon.available_to_staff){
                        header.push(addon.name);
                    }
                }
            }
        }
        if (!(exportType === 'not attending' || exportType === 'no response')){
            header.push('Checked In');
            if (event.pre_event_survey){
                for (const field of event.pre_event_survey.definition){
                    header.push(field.name);
                }
            }
            header.push('Notes');
        }
        output.push(header);

        let attendees = [];

        switch(exportType){
            case 'player':
                attendees = event.attendees.filter(attendee => {
                    return attendee.user.type === 'player';
                }).filter(attendee => {
                    return attendee.attending;
                });
                break;
            case 'staff':
                attendees = event.attendees.filter(attendee => {
                    return attendee.attending;
                });
                break;
            case 'not attending':
                attendees = event.attendees.filter(attendee => {
                    return !attendee.attending;
                });
                break;
            case 'no response': {
                const campaign_users = await req.models.campaign_user.find({campaign_id:req.campaign.id});
                let users = await async.map(campaign_users, async (campaign_user) => {
                    return req.models.user.get(req.campaign.id, campaign_user.user_id);
                });
                users = _.sortBy(users, 'typeForDisplay');
                attendees = users
                    .filter(user => {return user.type !== 'none'})
                    .filter(user => {return !_.findWhere(event.attendees, {user_id: user.id})})
                    .map(user => {
                        return {
                            user_id: user.id,
                            user: user
                        };
                    });
                break;
            }

        }

        for (const attendee of attendees){
            const row = [
                attendee.user.name,
                attendee.user.email,
            ];

            if (exportType === 'player'){
                if (attendee.user.type !== 'player'){
                    continue;
                }
                row.push(attendee.character.name);
                if (event.cost){
                    row.push(attendee.paid?'Yes':'No');
                }
                if (event.addons.length){
                    for (const addon of event.addons){
                        if (addon.available_to_player){
                            const attendee_addon = _.findWhere(attendee.addons, {event_addon_id:addon.id});
                            if (attendee_addon){
                                if (addon.charge_player){
                                    row.push(attendee_addon.paid?'Paid':'Unpaid')
                                } else {
                                    row.push('Yes');
                                }
                            } else {
                                row.push('No');
                            }
                        }
                    }
                }
            } else {
                if (exportType === 'staff' && attendee.user.type === 'player'){
                    continue;
                }
                row.push(attendee.user.typeForDisplay);
                if (event.addons.length){
                    for (const addon of event.addons){
                        if (addon.available_to_staff){
                            const attendee_addon = _.findWhere(attendee.addons, {event_addon_id:addon.id});
                            if (attendee_addon){
                                if (addon.charge_staff){
                                    row.push(attendee_addon.paid?'Paid':'Unpaid')
                                } else {
                                    row.push('Yes');
                                }
                            } else {
                                row.push('No');
                            }
                        }
                    }
                }
            }

            if (!(exportType === 'not attending' || exportType === 'no response')){
                row.push(attendee.checked_in?'Yes':'No');
                if (event.pre_event_survey){
                    for (const field of event.pre_event_survey.definition){
                        if (_.has(attendee.pre_event_data, field.id)){
                            if (field.type === 'boolean'){
                                row.push(attendee.pre_event_data[field.id].data?'Yes':'No');
                            } else {
                                row.push(attendee.pre_event_data[field.id].data);
                            }
                        } else if (_.has(attendee.pre_event_data, field.name)){
                            if (field.type === 'boolean'){
                                row.push(attendee.pre_event_data[field.name]?'Yes':'No');
                            } else {
                                row.push(attendee.pre_event_data[field.name]);
                            }
                        } else {
                            row.push(null);
                        }

                    }
                }
                row.push(attendee.notes);
            }

            output.push(row);
        }
        const csvOutput = await stringify(output, {});
        res.attachment(`${event.name} - ${exportType}.csv`);
        res.end(csvOutput);

    } catch (err){
        return next(err);
    }

}

async function showCheckin(req, res, next){
    const eventId = req.params.id;
    try {
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        };

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Events'},
                { url: `/event/${event.id}`, name: event.name },
            ],
            current: `Check-in`
        };

        res.locals.event = event;
        res.locals.title += ` - ${event.name} - Check-in`;
        res.locals.csrfToken = req.csrfToken();

        res.render('event/checkin');

    } catch (err){
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

async function showPostEventSurvey(req, res, next){
    const id = req.params.id;
    const attendanceId = req.params.attendanceId;

    res.locals.csrfToken = req.csrfToken();
    try{
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;

        const event = await req.models.event.get(id);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        if (!event.post_event_survey){
            req.flash('warning', 'No Post-Event Survey configured for this event.');
            return res.redirect('/');
        }

        res.locals.event = event;



        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Events'},
                { url: `/event/${event.id}`, name: event.name},
            ],
            current: 'Post Event Survey'
        };

        if (user.type.match(/^(core staff|admin)$/) && attendanceId){
            const attendance = await req.models.attendance.get(attendanceId);
            if (!attendance || attendance.event_id !== event.id){
                throw new Error ('Invalid Attendance');
            }

            res.locals.attendance = attendance;

        } else {
            const attendance = await req.models.attendance.findOne({event_id:event.id, user_id:user.id});
            if (!attendance || attendance.event_id !== event.id){
                throw new Error ('Invalid Attendance');
            }
            res.locals.attendance = attendance;

        }

        if (_.has(req.session, 'postEventData')){
            res.locals.attendance.post_event_data = req.session.postEventData.post_event_data;
            delete req.session.postEventData;
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
    req.session.postEventData = attendance;
    const action = req.body.action ||= 'save';

    try {
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;

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

        if (! user.type.match(/^(core staff|admin)$/) && current.user_id !== user.id){
            throw new Error('Not allowed to edit this post event survey');
        }

        if (!event.post_event_survey){
             throw new Error('Event does not have a Post Event Survey');
        }

        if (current.post_event_submitted){
            req.flash('warning', 'Post Event Survey already submitted');
            return res.redirect('/');
        }

        current.post_event_data = surveyHelper.parseData(
            attendance.post_event_data,
            event.post_event_survey.definition,
            current.post_event_data,
            user.type
        );
        let cpGranted = false;
        console.log(action)
        switch (action){
            case 'hide':
                current.post_event_hidden = true;
                break;
            case 'unhide':
                current.post_event_hidden = false;
                break;
            case 'submit':
                current.post_event_submitted = true;
                current.post_event_data.submitted_at = new Date();
                if (req.campaign.post_event_survey_cp && !current.post_event_cp_granted && current.user.type === 'player'){
                    if (new Date(event.post_event_survey_deadline) > new Date()){
                        await req.models.cp_grant.create({
                            campaign_id: req.campaign.id,
                            user_id: current.user_id,
                            content: `Post Event Survey for ${event.name}`,
                            amount: req.campaign.post_event_survey_cp,
                            status: 'approved'
                        });
                        current.post_event_cp_granted = true;
                        cpGranted = true;
                    }
                }
                break;
        }

        await req.models.attendance.update(attendanceId, current);
        delete req.session.postEventData;

        switch (action){
            case 'hide':
                req.flash('success', `Post Event Survey for ${event.name} has been removed from the Task List.`);
                break
            case 'unhide':
                req.flash('success', `Post Event Survey for ${event.name} has been restored to the Task List.`);
                break
            case 'submit': {
                let resultStr = `Submitted Post Event Survey for ${event.name}`;
                if (cpGranted){
                    resultStr += ` and granted ${req.campaign.post_event_survey_cp} CP.`;
                } else {
                    resultStr += '.';
                }
                req.flash('success', resultStr);
                break;
            }
            default:
                req.flash('success', `Saved Post Event Survey for ${event.name} for later submission.`);
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
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;

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
        if ((! user.type.match(/^(core staff|admin)$/)) && current.user_id !== user.id){
            throw new Error('Not allowed to edit this post event survey');
        }

        if (current.post_event_submitted){
            return res.json({success:false, message: 'Post Event Survey already submitted'});
        }

        if (!event.post_event_survey){
             throw new Error('Event does not have a Post Event Survey');
        }

        current.post_event_data = surveyHelper.parseData(
            attendance.post_event_data,
            event.post_event_survey.definition,
            current.post_event_data,
            user.type
        );

        await req.models.attendance.update(attendanceId, current);
        res.json({success:true});

    } catch (err){
        res.json({success:false, error:err.message});
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
                const doc = surveyHelper.formatPostEventData(attendance, event);
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
                    if (_.has(survey.data, field.id)){
                        if (field.type==='boolean'){
                            row.push(survey.data[field.id].data?'Yes':'No');
                        } else {
                            row.push(removeMd(survey.data[field.id].data));
                        }
                    }
                }
            }
            output.push(row);
        }
        const csvOutput = await stringify(output, {});
        res.attachment(`${event.name} - Post Event Surveys.csv`);
        res.end(csvOutput);

    } catch (err) {
        next(err);
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

function parseAttendeeAddons(input, forGm){
    const output = [];
    for (const addon of input){
        if (addon.selected){
            const doc:  AttendeeAddon = {
                event_addon_id: Number(addon.addon_id)
            }
            if (addon.id !== ''){
                doc.id = Number(addon.id)
            }
            if (forGm){
                doc.paid = _.has(addon, 'paid');
            }
            output.push(doc);
        }
    }
    return output;

}

const router = express.Router();

router.use(permission('player'));
router.use(function(req, res, next){
    res.locals.siteSection=['gm', 'character'];
    next();
});

router.get('/', list);
router.get('/new', csrf(), permission('gm'), showNew);
router.get('/:id', csrf(), show);
router.get('/:id/edit', csrf(), permission('gm'), showEdit);
router.get('/:id/export', csrf(), permission('contrib, registration view'), exportEventAttendees);
router.get('/:id/export_survey', csrf(), permission('contrib'), exportPostEventSurveys);
router.get('/:id/pdf', csrf(), permission('contrib'), exportPlayerPdfs);
router.post('/', csrf(), permission('gm'), create);
router.put('/:id', csrf(), permission('gm'), update);
router.delete('/:id', permission('admin'), remove);
router.put('/:id/grant_cp', csrf(), permission('gm'), grantAttendanceCp);

router.get('/:id/checkin', csrf(), permission('contrib, registration view'), showCheckin);
router.post('/:id/checkin/:attendanceId', csrf(), permission('contrib, registration edit'), markCheckedIn);
router.post('/:id/uncheckin/:attendanceId', csrf(), permission('contrib, registration edit'), unmarkCheckedIn);

router.get('/:id/register', csrf(), showNewAttendance);
router.post('/:id/register', csrf(), createAttendance);
router.post('/:id/not_attending', csrf(), createNotAttendance);
router.get('/:id/register/:attendanceId', csrf(), showEditAttendance);
router.put('/:id/register/:attendanceId', csrf(), updateAttendance);
router.delete('/:id/register/:attendanceId', csrf(), removeAttendance);

router.get('/:id/post_event/', csrf(), showPostEventSurvey);
router.get('/:id/post_event/:attendanceId', csrf(), showPostEventSurvey);
router.put('/:id/post_event/:attendanceId', csrf(), submitPostEventSurvey);
router.put('/:id/post_event/:attendanceId/api', csrf(), savePostEventSurveyApi);

export default router;
