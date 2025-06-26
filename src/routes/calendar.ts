import express from 'express';
import _ from 'underscore';
import config from 'config';
import scheduleHelper from '../lib/scheduleHelper';
import ical, { ICalCalendarMethod } from 'ical-generator';
import { DateTime, Interval } from "luxon";
import removeMd from 'remove-markdown';

async function calendar(req, res, next){
    const calendar_id = req.params.calendar_id;
    try{
        const campaign_user = await req.models.campaign_user.findOne({calendar_id:calendar_id});
        if (!campaign_user || campaign_user.campaign_id !== req.campaign.id || campaign_user.type === 'none'){
            throw new Error('Invalid Calendar');
        }

        const events = await req.models.event.find({campaign_id:req.campaign.id, deleted:false});

        const user = await req.models.user.get(req.campaign.id, campaign_user.user_id);

        const calendarItems = [];

        for (const event of events){
            event.url = `${config.get('app.secureOnly')?'https':'http'}://${req.campaign.site}/event/${event.id}`
            event.timezone = req.campaign.timezone;
            event.days = eventCalculate(event);

            if ((user.type !== 'player' && event.schedule_status !== 'private') ||
                (user.type === 'player' && event.schedule_status === 'player visible')){
                const schedule = await scheduleHelper.getUserSchedule(event.id, campaign_user.user_id, user.type === 'player');

                event.sceneCount = 0;
                for (const timeslot of schedule){
                    for (const scene of timeslot.scenes){
                        if (!_.findWhere(calendarItems, {id: scene.guid})){
                            calendarItems.push(formatScene(scene, event));
                            event.sceneCount++;
                        }
                    }
                    if (timeslot.schedule_busy){
                        calendarItems.push(formatScheduleBusy(timeslot.schedule_busy, timeslot, event));
                    }
                }
            }


            calendarItems.push(formatEvent(event))
        }

        const calendar = ical({ name: req.campaign.name });
        calendar.method(ICalCalendarMethod.PUBLISH);
        calendar.timezone(req.campaign.timeszone);

        for (const item of calendarItems){
            calendar.createEvent(item);
        }

        res.writeHead(200, {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="${req.campaign.name}-calendar.ics"`,
        });

        res.end(calendar.toString());

    } catch (err){
        next(err);
    }
}

function eventCalculate(event) {
    const eventStart = DateTime.fromJSDate(event.start_time).setZone(event.timezone).startOf('day');
    const eventEnd = DateTime.fromJSDate(event.end_time).setZone(event.timezone);
    let eventDays = Interval.fromDateTimes(eventStart, eventEnd).splitBy({days:1});
    eventDays = _.indexBy(eventDays, day => { return day.start.toFormat('EEE').toLowerCase() });
    for (const day in eventDays){
        const hours = eventDays[day].splitBy({hours:1});
        eventDays[day] = _.indexBy(hours, hour => { return hour.start.hour});
        for (const hour in eventDays[day]){
            const minutes = eventDays[day][hour].splitBy({minutes:1});
            eventDays[day][hour] = _.indexBy(minutes, minute => { return minute.start.minute});
        }
    }
    return eventDays;

}

function timeslotCalculate(event, timeslot) {
    const timeslotStartInterval = (event.days[timeslot.day][''+timeslot.start_hour][''+timeslot.start_minute]);

    if (!timeslotStartInterval){
        throw new Error('Could not find timeslot start');
    }
    const timeslotStart = timeslotStartInterval.start;

    const timeslotEnd = timeslotStart.plus({minutes:timeslot.length});
    return {
        start: timeslotStart,
        end: timeslotEnd,
    }
}

function formatScene(scene, event){
    const timeslots = scene.timeslots.confirmed;
    if (!timeslots){ return; }
    const sceneStart = (timeslotCalculate(event, timeslots[0])).start;
    const sceneEnd = (timeslotCalculate(event, timeslots[timeslots.length-1])).end;
    return {
        id: scene.guid,
        start: sceneStart,
        end: sceneEnd,
        summary: scene.name,
        description: removeMd(scene.description),
        location: _.pluck(scene.locations.confirmed, 'name').join(', '),
        url: scene.staff_url,
    }

}

function formatScheduleBusy(busy, timeslot, event){
    const busyTimeslot = timeslotCalculate(event, timeslot);
    return {
        id: busy.guid,
        start: busyTimeslot.start,
        end: busyTimeslot.end,
        summary: busy.name
    }

}

function formatEvent(event){
    return {
        id: event.guid,
        start: DateTime.fromJSDate(event.start_time).setZone(event.timezone),
        end: DateTime.fromJSDate(event.end_time).setZone(event.timezone),
        summary: event.name,
        description: removeMd(event.description),
        location: event.location,
        url: event.url
    }
}

const router = express.Router();

router.get('/:calendar_id', calendar);

export default router;
