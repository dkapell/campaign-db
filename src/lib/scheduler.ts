'use strict';
import _ from 'underscore';
import async from 'async';
import models from './models';
import Schedule from './scheduler/Schedule';

import AutoScheduler from './scheduler/AutoScheduler';
import ScheduleScene from './scheduler/ScheduleScene';
import scheduleHelper from './scheduleHelper';


function getScheduler(eventId:number, options:SchedulerOptions={}): AutoScheduler{
    return new AutoScheduler(eventId, options);
}

async function clearSchedule(eventId:number): Promise<SchedulerOutput>{
    const event = await models.event.get(eventId);
    const eventScenes = await models.scene.find({event_id:eventId});
    const unassignedScenes = (await models.scene.find({campaign_id: event.campaign_id, status:'ready'})).filter(scene => {
        return !scene.event_id || scene.event_id === eventId || _.indexOf(_.pluck(eventScenes, 'id'), scene.id) !== -1;

    });
    const rawScenes = [...eventScenes, ...unassignedScenes];

    await async.each(rawScenes, async(scene) => {
        const sceneObj = new ScheduleScene(scene);
        return sceneObj.clear();
    });
    await scheduleHelper.saveSchedule(eventId, 'cleared');
    const schedule = new Schedule(eventId, rawScenes);
    return {schedule: schedule};
}


export default {
    get: getScheduler,
    clear: clearSchedule
};
