'use strict';
import async from 'async'
import _ from 'underscore'
import config from 'config'
import models from '../models';
import { finished } from 'node:stream/promises';
import {Readable} from 'node:stream';

import Schedule from './Schedule';
import ScheduleScene from './ScheduleScene';
import ScheduleCache from './ScheduleCache';
import scheduleHelper from '../scheduleHelper';


class AutoScheduler extends Readable{
    event_id: number;
    options: SchedulerOptions;


    constructor(eventId, options){
        super({objectMode:true});
        this.event_id = eventId;
        this.options = options;

    }

    _read(){
    }

    async run(){
        const eventId = this.event_id;
        const options = this.options;
        const start =  (new Date()).getTime();
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

        const sendData = (function(data){
            this.push(data)
        }).bind(this);

        const schedulerStatuses = {};
        let lastStatusSent = (new Date).getTime();

        await async.timesLimit(runs, concurrency, async function(schedulerIdx): Promise<SchedulerResult>{
            const scenesToPlace = scoredScenes.map(scene => { return new ScheduleScene(JSON.parse(JSON.stringify(scene)), cache); });
            const schedule = new Schedule(eventId, scenes, cache);
            schedulerStatuses[schedulerIdx] = {scheduler: 'running', scenes:{}};


            schedule.on('data', (data) => {
                switch (data.type){
                    case 'scene status':
                        schedulerStatuses[schedulerIdx].scenes[data.sceneId] = data.status;
                        if (((new Date).getTime() - lastStatusSent) > 100){
                            sendData({
                                type: 'scene status',
                                scenes: scenesToPlace.length,
                                runs: runs,
                                status: formatScheduleStatus(schedulerStatuses)
                            });
                            lastStatusSent = (new Date).getTime();
                        }
                        break;
                    case 'status':
                        sendData({
                            type:'status',
                            message:data.message});
                        break;
                }
            });
            schedule.on('error', (err) => {
                throw new Error(err.message);
            });

            schedule.run(scenesToPlace, options, schedulerIdx);
            await finished(schedule);
            schedulerStatuses[schedulerIdx].scheduler = 'done'
            attempts.push(schedule.summary);
            return;
        });

        const schedule = _.max(attempts, 'happiness');

        const happyAvg = Math.floor(_.pluck(attempts, 'happiness').reduce((o,e) => {
            return o + e;
        }, 0)/attempts.length);

        await schedule.schedule.write();
        await scheduleHelper.saveSchedule(eventId, 'scheduler');
        this.push({
            type: 'summary',
            schedule: schedule.schedule,
            unscheduled: schedule.unscheduled,
            attempts: attempts.length,
            issues: schedule.issues,
            happiness: {
                max: schedule.happiness,
                avg: happyAvg
            },
            scenesProcessed: schedule.scenesProcessed,
            processTime: (new Date()).getTime() - start
        });
        this.push(null);
    }
}

function formatScheduleStatus(data){
    const output = {};
    for (const schedulerIdx in data){

        output[schedulerIdx] = {
            scenes: _.countBy(data[schedulerIdx].scenes),
            scheduler: data[schedulerIdx].scheduler
        };
    }
    return output;
}

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

    scene.score += (scene.locations_count * Number(config.get('scheduler.score.locations_count')));
    scene.score -= scene.locations.filter(location => {
        return location.scene_request_status !== 'none';
    }).length;

    scene.score += (scene.timeslot_count * Number(config.get('scheduler.score.timeslot_count')));
    scene.score += scene.setup_slots * Number(config.get('scheduler.score.timeslot_count'));
    scene.score += scene.cleanup_slots * Number(config.get('scheduler.score.timeslot_count'));
    scene.score -= scene.timeslots.filter(timeslot => {
        return timeslot.scene_request_status !== 'none';
    }).length;

    scene.score += scene.player_count_max;
    scene.score += scene.staff_count_max;

    return scene;
}



export default AutoScheduler;
