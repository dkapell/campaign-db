'use strict';
import _ from 'underscore';
import async from 'async';
import config from 'config'
import models from './models';
import scheduleHelper from './scheduleHelper';
import Schedule from './scheduler/Schedule';

import ScheduleScene from './scheduler/ScheduleScene';
import ScheduleCache from './scheduler/ScheduleCache';

async function prepScenes(scenes:SceneModel[]): Promise<SceneModel[]>{
    scenes = scoreScenes(scenes);
    for (const scene of scenes){
        for (const prereq of scene.prereqs){
            const prereqId = getPrereqId(prereq);
            const prereqScene = _.findWhere(scenes, {id:prereqId});
            if (!_.has(prereqScene, 'prereq_of')){
                prereqScene.prereq_of = []
            }
            prereqScene.prereq_of.push(scene.id);
        }

    }
    return scenes;
}

function getPrereqId(prereq:string|number|SceneModel):number{
    let prereqId:number = null;
    if (typeof prereq === 'number'){
        return prereq;
    } else if (typeof prereq === 'string'){
        const prereqData:SceneModel = JSON.parse(prereq);
        return prereqData.id;
    } else {
        return prereq.id;
    }

}
function scoreScenes(scenes:SceneModel[]): SceneModel[]{
    scenes = scenes.map(scoreScene)
        .map(scene => {
            if (scene.prereqs.length){
                scene.score += 5
            }
            for (const prereq of scene.prereqs){
                const prereqId = getPrereqId(prereq);
                const prereqScene = _.findWhere(scenes, {id:prereqId});
                if (prereqScene && (scene.score >= prereqScene.score)){

                    prereqScene.score = scene.score + 1;
                }
            }
            return scene;
        })

    scenes = _.sortBy(scenes, 'score').reverse();

    return scenes;
}

function scoreScene(scene:SceneModel): SceneModel{
    scene.score = 0;
    scene.score += (scene.locations_count * Number(config.get('scheduler.points.locations_count')));
    scene.score -= scene.locations.filter(location => {
        return location.scene_request_status !== 'none';
    }).length;
    scene.score += (scene.timeslot_count * Number(config.get('scheduler.points.timeslot_count')));
    scene.score -= scene.timeslots.filter(timeslot => {
        return timeslot.scene_request_status !== 'none';
    }).length;
    scene.score += scene.player_count_max;
    scene.score += scene.staff_count_max;

    return scene;
}

interface SchedulerOutput{
    schedule: Schedule
    attempts?: number
    unscheduled?: number
    scenesProcessed?: number
    happiness?: Record<string,number>
}

async function runScheduler(eventId:number, options:SchedulerOptions={}): Promise<SchedulerOutput>{
    const event = await models.event.get(eventId);
    const eventScenes = await models.scene.find({event_id:eventId});

    const unassignedScenes = (await models.scene.find({campaign_id: event.campaign_id, status:'ready'})).filter(scene => {
        return !scene.event_id || scene.event_id === eventId || _.indexOf(_.pluck(eventScenes, 'id'), scene.id) !== -1;

    });
    const rawScenes = [...eventScenes, ...unassignedScenes];

    const scoredScenes = await prepScenes(rawScenes);

    const cache = new ScheduleCache(event.campaign_id, event.id);
    await cache.fill();

    await async.each(scoredScenes, async(scene) => {
        const sceneObj = new ScheduleScene(scene, cache);
        return sceneObj.clear();
    });
    const scenes = await models.scene.find({event_id:eventId});

    const runs = (options.runs && options.runs <= 100)?options.runs:config.get('scheduler.runs') as number;
    const concurrency = (options.concurrency&& options.concurrency <= 20)?options.concurrency:5;
    const attempts = [];

    await async.timesLimit(runs, concurrency, async function(idx): Promise<SchedulerResult>{
        const scenesToPlace = scoredScenes.map(scene => { return new ScheduleScene(JSON.parse(JSON.stringify(scene)), cache); });
        const schedule = new Schedule(eventId, scenes, cache);
        attempts.push(await schedule.run(scenesToPlace, options));
        return;
    });

    const schedule = _.max(attempts, 'happiness');

    const happyAvg = Math.floor(_.pluck(attempts, 'happiness').reduce((o,e) => {
        return o + e;
    }, 0)/attempts.length);

    await schedule.schedule.write();

    return {
        schedule: schedule.schedule,
        unscheduled: schedule.unscheduled,
        attempts: attempts.length,
        happiness: {
            max: schedule.happiness,
            avg: happyAvg
        },
        scenesProcessed: schedule.scenesProcessed
    }
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

    const schedule = new Schedule(eventId, rawScenes);
    return {schedule: schedule};
}


export default {
    scoreScenes,
    run: runScheduler,
    clear: clearSchedule
};
