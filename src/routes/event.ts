import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import async from 'async';
import stringify from 'csv-stringify-as-promised';
import permission from '../lib/permission';
import Character from '../lib/Character';
import characterRenderer from '../lib/renderer/character';

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
            throw new Error('Invalid Skill Tag');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Events'},
            ],
            current: event.name
        };
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
            start_time: null,
            end_time: null,
            registration_open: false,
            cost: req.campaign.event_default_cost?req.campaign.event_default_cost:0,
            location: req.campaign.event_default_location?req.campaign.event_default_location:null
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
    if (!_.has(event, 'registration_open')){
        event.registration_open = false;
    }
    event.campaign_id = req.campaign.id;

    try{
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

    if (!_.has(event, 'registration_open')){
        event.registration_open = false;
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
        res.locals.attendance = attendance;

        const user = req.session.assumed_user ? req.session.assumed_user: req.user;

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


        if (_.has(req.session, 'attendanceData')){
            res.locals.event = req.session.attendanceData;
            delete req.session.attendanceData;
        }
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
            req.flash('success', 'Already Registered');
            return res.redirect(`/event/${event.id}`)
        }

        attendance.campaign_id = req.campaign.id;

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

        await req.models.attendance.update(attendanceId, attendance);
        await req.audit('attendance', attendanceId, 'update', {old: current, new:attendance});
        delete req.session.attendanceData;
        req.flash('success', `Updated registration of ${user.name} for ${event.name}`);
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
        req.flash('success', `Unregistered ${user.name} from ${event.name}`);
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
        for (const field of req.campaign.event_fields){
            header.push(field.name);
        }

        header.push('Notes');
        output.push(header);

        for (const attendee of event.attendees){
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
                if (attendee.user.type === 'player'){
                    continue;
                }
                row.push(attendee.user.typeForDisplay);
            }
            for (const field of req.campaign.event_fields){
                if (_.has(attendee.data, field.name)){
                    row.push(attendee.data[field.name]);
                } else {
                    row.push(null);
                }
            }
            row.push(attendee.notes);

            output.push(row);
        }
        const csvOutput = await stringify(output, {});
        res.attachment(`${event.name} - ${exportType==='player'?'Players':'Staff'}.csv`);
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
        const characters = await async.map(event.players, async(player) => {
            const character = new Character({id:player.character_id});
            await character.init();
            return character.data();
        });
        const pdf = await characterRenderer(characters, {
            skillDescriptions:!!req.query.descriptions,
            showLanguages:!!req.query.languages
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
router.get('/:id/register/:attendanceId', csrf(), showEditAttendance);
router.put('/:id/register/:attendanceId', csrf(), updateAttendance);
router.delete('/:id/register/:attendanceId', csrf(), removeAttendance);

export default router;
