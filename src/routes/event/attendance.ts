import _ from 'underscore';
import async from 'async';
import stringify from 'csv-stringify-as-promised';
import removeMd from 'remove-markdown';

import surveyHelper from '../../lib/surveyHelper';
import orderHelper from '../../lib/orderHelper';

async function showNewAttendance(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();
     try{
        const user = req.session.activeUser;

        const event = await req.models.event.get(id);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        if (req.checkPermission('gm')){
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
                return res.redirect(`/event/${event.id}/register/${attendance.id}`)
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
            user_id: user.id,
            paid_by_order:false

        };

        const preEventResult = await req.models.survey_response.findOne({
            user_id:user.id,
            event_id:event.id,
            survey_id:event.pre_event_survey_id
        });

        if (preEventResult){
            res.locals.attendance.pre_event_data = preEventResult.data;
        }

        if (_.has(req.session, 'attendanceData')){
            res.locals.attendance = req.session.attendanceData;
            delete req.session.attendanceData;
        }

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

        let attendance = await req.models.attendance.get(req.params.attendanceId);
        if (!attendance || attendance.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        res.locals.event = event;

        if (!_.has(attendance, 'pre_event_data') || ! attendance.pre_event_data){
            attendance.pre_event_data = {};
        }

        attendance = await surveyHelper.fillAttendance(attendance, event);
        attendance.paid_by_order = await orderHelper.isPaid('attendance', attendance.id);
        attendance.addons = await async.map(attendance.addons, async(addon) => {
            addon.paid_by_order = await orderHelper.isPaid('attendance_addon', addon.id);
            return addon;
        });
        res.locals.attendance = attendance;

        if (_.has(req.session, 'attendanceData')){
            res.locals.attendance = req.session.attendanceData;
            res.locals.attendance.user_id = attendance.user_id;
            delete req.session.attendanceData;
        }

        res.locals.attendance.user = await req.models.user.get(req.campaign.id, res.locals.attendance.user_id )


        const user = req.session.activeUser;

        if (!attendance.character_id){
            const characters = await req.models.character.find({campaign_id:req.campaign.id, user_id:user.id});
            const activeCharacter = _.findWhere(characters, {active:true});
            res.locals.attendance.character_id = activeCharacter?activeCharacter.id:null;
        }

        if (req.checkPermission('gm')) {
            const campaign_users = await req.models.campaign_user.find({campaign_id:req.campaign.id});
            let users = await async.map(campaign_users, async (campaign_user) => {
                const user = await req.models.user.get(req.campaign.id, campaign_user.user_id);
                return user;
            });
            users = users.filter(user => { return user.type !== 'none'});
            res.locals.users = _.sortBy(users, 'typeForDisplay')
        } else if ( attendance.user_id !== user.id && !req.checkPermission('registration edit')){
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

        let user = req.session.activeUser;

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        attendance.event_id = eventId;

        if (req.checkPermission('gm')) {
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
        attendance.addons = parseAttendeeAddons(attendance.addons, req.checkPermission('gm'));
        attendance.addons = await filterAttendeeAddons(req, attendance.addons);

        attendance.pre_event_survey_response_id = await surveyHelper.savePreEventModel(null, attendance);

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

        let user = req.session.activeUser;

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
                req.flash('error', 'Currently marked attending, unregister first');
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
        const user = req.session.activeUser;

        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        let current = await req.models.attendance.get(attendanceId);

        if (!current || current.event_id !== event.id){
            throw new Error('Invalid Registration');
        }

        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        let typeForSurvey = user.type;
        if (user.type.match(/^(core staff|admin)$/)){
            if (!_.has(attendance, 'paid')){
                if (await orderHelper.isPaid('attendance', attendanceId)){
                    attendance.paid = true;
                } else {
                    attendance.paid = false;
                }
            }
        } else if (req.checkPermission('registration edit')){
            delete attendance.paid;
            attendance.user_id = current.user_id;
            typeForSurvey = 'core staff';

        } else {
            if (current.user_id !== user.id){
                throw new Error('Not allowed to edit this registration');
            }
            attendance.user_id = current.user_id
        }

        current = await surveyHelper.fillAttendance(current, event);

        if (attendance.character_id === ''){
            attendance.character_id = null;
        }

        if (event.pre_event_survey){
            attendance.pre_event_data = surveyHelper.parseData(
                attendance.pre_event_data,
                event.pre_event_survey.definition,
                current.pre_event_data,
                typeForSurvey
            );
        }

        attendance.attending = true;
        attendance.event_id = event.id;

        attendance.addons = parseAttendeeAddons(attendance.addons, req.checkPermission('gm'));
        attendance.addons = await filterAttendeeAddons(req, attendance.addons);
        attendance.pre_event_survey_response_id = await surveyHelper.savePreEventModel(current.pre_event_survey_response_id, attendance);
        attendance.campaign_id = current.campaign_id;
        req.session.attendanceData = attendance;
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
            throw new Error('Can not delete record from different campaign');
        }
        if (! user.type.match(/^(core staff|admin)$/) && current.user_id !== user.id){
            throw new Error('Not allowed to edit this registration');
        }

        const isPaid = current.paid || current.addons.filter(addon => { return addon.paid}).length;
        if (isPaid){
            req.flash('error', 'Can not withdraw from a paid event.  Please contact staff to manage this event registration.');
            return res.redirect(`/event/${event.id}`);
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
            header.push('Checked In');

            if (event.addons.length){
                for (const addon of event.addons){
                    if (addon.available_to_player && exportType === 'player'){
                        header.push(addon.name);
                    }

                    if (addon.available_to_staff && exportType === 'staff'){
                        header.push(addon.name);
                    }
                }
            }

            for (const documentation of req.campaign.documentations){
                if (!documentation.on_checkin){ continue; }
                header.push(documentation.name)
            }

            if (event.pre_event_survey){
                for (const field of event.pre_event_survey.definition){
                    if (field.type === 'text content') { continue; }
                    if (field.visible_to === 'player' && exportType === 'staff') { continue; }
                    if (field.visible_to === 'staff' && exportType === 'player') { continue; }
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
                    .filter(user => {return !user.occasional_attendee})
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
                row.push(attendee.checked_in?'Yes':'No');

                if (exportType === 'player'){
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

                for (const documentation of req.campaign.documentations){
                    if (!documentation.on_checkin){ continue; }

                    const userDoc = _.findWhere(attendee.documentations, {documentation_id:documentation.id});
                    if (!userDoc){
                        row.push('No');
                    } else if (userDoc.status === 'valid') {
                        row.push('Yes');
                    } else if (userDoc.status === 'expired'){
                        row.push('Expired');
                    } else {
                        row.push('No');
                    }
                }

                if (event.pre_event_survey){
                    for (const field of event.pre_event_survey.definition){
                        if (field.type === 'text content') { continue; }
                        if (field.visible_to === 'player' && exportType === 'staff') { continue; }
                        if (field.visible_to === 'staff' && exportType === 'player') { continue; }


                        if (field.type==='boolean' || field.type === 'image'){
                            if (_.has(attendee.pre_event_data, field.id)){
                                row.push(attendee.pre_event_data[field.id].data?'Yes':'No');
                            } else if (_.has(attendee.pre_event_data, field.name)){
                                row.push(attendee.pre_event_data[field.name]?'Yes':'No');
                            } else {
                                row.push('No');
                            }
                        } else {
                            if (_.has(attendee.pre_event_data, field.id)){
                                row.push(removeMd(attendee.pre_event_data[field.id].data));
                            } else if (_.has(attendee.pre_event_data, field.name)){
                                row.push(removeMd(attendee.pre_event_data[field.name]));
                            } else {
                                row.push(null);
                            }
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
            if (addon.cost){
                doc.cost = addon.cost;
            }
            output.push(doc);
        }
    }
    return output;
}

async function filterAttendeeAddons(req, addons: AttendeeAddon[]){
    return async.map(addons, async(addon) => {
        if (addon.paid) { return addon; }
        if (!addon.id){ return addon; }
        if (await orderHelper.isPaid('attendance_addon', addon.id)){
            addon.paid = true;
        }
        return addon;
    });
}

export default {
    showNew: showNewAttendance,
    showEdit: showEditAttendance,
    create: createAttendance,
    update: updateAttendance,
    remove: removeAttendance,
    createNot: createNotAttendance,
    export: exportEventAttendees
}
