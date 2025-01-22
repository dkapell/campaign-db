import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import async from 'async';
import stringify from 'csv-stringify-as-promised';
import permission from '../lib/permission';
import Character from '../lib/Character';
import characterRenderer from '../lib/renderer/character';
import campaignHelper from '../lib/campaignHelper';

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
            hide_attendees: false
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Events'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

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
        const event = await req.models.event.get(id);
        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        const start_times = await campaignHelper.splitTime(req.campaign.id, event.start_time);
        event.start_date = start_times.date;
        event.start_hour = start_times.hour;
        const end_times = await campaignHelper.splitTime(req.campaign.id, event.end_time);
        event.end_date = end_times.date;
        event.end_hour = end_times.hour;
        res.locals.event = event;
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

    try{
        event.campaign_id = req.campaign.id;
        event.start_time = await campaignHelper.parseTime(req.campaign.id, event.start_date, Number(event.start_hour))
        event.end_time = await campaignHelper.parseTime(req.campaign.id, event.end_date, Number(event.end_hour))

        const hidden_fields = [];
        for (const field of req.campaign.event_fields){
            if (!_.has(event.hidden_fields, field.name)){
                hidden_fields.push(field.name);
            }
        }
        event.hidden_fields = JSON.stringify(hidden_fields);

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

    try {
        const current = await req.models.event.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        if (current.deleted){
            throw new Error('Can not edit deleted record');
        }

        event.start_time = await campaignHelper.parseTime(req.campaign.id, event.start_date, Number(event.start_hour))
        event.end_time = await campaignHelper.parseTime(req.campaign.id, event.end_date, Number(event.end_hour))

        const hidden_fields = [];
        for (const field of req.campaign.event_fields){
            if (!_.has(event.hidden_fields, field.name)){
                hidden_fields.push(field.name);
            }
        }
        event.hidden_fields = JSON.stringify(hidden_fields);

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
            data: {},
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

        if (user.type.match(/^(core staff|admin)$/)){
            const campaign_users = await req.models.campaign_user.find({campaign_id:req.campaign.id});
            let users = await async.map(campaign_users, async (campaign_user) => {
                const user = await req.models.user.get(req.campaign.id, campaign_user.user_id);
                return user;
            });
            users = users.filter(user => { return user.type !== 'none'});
            res.locals.users = _.sortBy(users, 'typeForDisplay')
        } else if ( attendance.user_id !== user.id){
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

        for (const field of req.campaign.event_fields){
            if (field.type === 'boolean'){
                if(!_.has(attendance.data, field.name)){
                    attendance.data[field.name] = false;
                } else {
                    attendance.data[field.name] = true;
                }
            }
        }
        attendance.attending = true;
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
        } else {
            if (current.user_id !== user.id){
                throw new Error('Not allowed to edit this registration');
            }
            delete attendance.paid;
            delete attendance.user_id;
        }

        if (attendance.character_id === ''){
            attendance.character_id = null;
        }


        for (const field of req.campaign.event_fields){
            if (field.type === 'boolean'){
                if(!_.has(attendance.data, field.name)){
                    attendance.data[field.name] = false;
                } else {
                    attendance.data[field.name] = true;
                }
            }
        }

        attendance.attending = true;

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
        } else {
            header.push('Type');
        }
        if (!(exportType === 'not attending' || exportType === 'no response')){
            for (const field of req.campaign.event_fields){
                if (_.indexOf(event.hidden_fields, field.name) !== -1){
                    continue;
                }
                header.push(field.name);
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
            } else {
                if (exportType === 'staff' && attendee.user.type === 'player'){
                    continue;
                }
                row.push(attendee.user.typeForDisplay);
            }

            if (!(exportType === 'not attending' || exportType === 'no response')){

                for (const field of req.campaign.event_fields){
                    if (_.indexOf(event.hidden_fields, field.name) !== -1){
                        continue;
                    }

                    if (_.has(attendee.data, field.name)){
                        if (field.type === 'boolean'){
                            row.push(attendee.data[field.name]?'Yes':'No');
                        } else {
                            row.push(attendee.data[field.name]);
                        }
                    } else {
                        row.push(null);
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
router.get('/:id/export', csrf(), permission('contrib'), exportEventAttendees);
router.get('/:id/pdf', csrf(), permission('contrib'), exportPlayerPdfs);
router.post('/', csrf(), permission('gm'), create);
router.put('/:id', csrf(), permission('gm'), update);
router.delete('/:id', permission('admin'), remove);

router.get('/:id/register', csrf(), showNewAttendance);
router.post('/:id/register', csrf(), createAttendance);
router.post('/:id/not_attending', csrf(), createNotAttendance);
router.get('/:id/register/:attendanceId', csrf(), showEditAttendance);
router.put('/:id/register/:attendanceId', csrf(), updateAttendance);
router.delete('/:id/register/:attendanceId', csrf(), removeAttendance);

export default router;
