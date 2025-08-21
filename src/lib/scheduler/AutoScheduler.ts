'use strict';
import async from 'async'
import _ from 'underscore'
import config from 'config'
import models from '../models';
import {Readable} from 'node:stream';

import Schedule from './Schedule';
import ScheduleScene from './ScheduleScene';
import ScheduleCache from './ScheduleCache';
import scheduleHelper from '../scheduleHelper';


class AutoScheduler extends Readable{
    event_id: number;
    options: SchedulerOptions;

    messages = [];
    constructor(eventId, options){
        super({objectMode:true});
        this.event_id = eventId;
        this.options = options;

    }

    _read(){
        if (this.messages.length){
            this.push(this.messages.shift());
            return true;
        } else {
            return false;
        }
    }

    sendData(message){
        if (this.readableFlowing){
            this.push(message)
        } else {
            this.messages.push(message);
        }
    }

    async run(){
        this.sendData({
            type: 'scheduler status',
            message: `Starting AutoScheduler on event id:${this.event_id}`
        });

        const eventId = this.event_id;
        const options = this.options;
        const start =  (new Date()).getTime();
        const event = await models.event.get(eventId);
        const eventScenes = await models.scene.find({event_id:eventId});

        this.sendData({
            type: 'scheduler status',
            message: `Data Gathered for event id:${this.event_id}`
        });

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

        this.sendData({
            type: 'scheduler status',
            message: `Cleared Schedule for event id:${this.event_id}`
        });

        const runs = (options.runs && options.runs <= 100)?options.runs:config.get('scheduler.runs') as number;
        const concurrency = (options.concurrency&& options.concurrency <= 20)?options.concurrency:5;
        const attempts = [];

        const schedulerStatuses = {};
        //let lastStatusSent = 0;
        const keepalive = setInterval(()=>{
            this.sendData({
                type: 'keepalive',
            });
        }, 10*1000);

        const statusSend = setInterval(() => {
            this.sendData({
                type: 'scene status',
                scenes: scoredScenes.length,
                runs: runs,
                status: formatScheduleStatus(schedulerStatuses)
            });
        }, 100);

        // Get list of scenes after clear
        const scenes = await models.scene.find({event_id:eventId});

        await async.timesLimit(runs, concurrency, async (schedulerIdx): Promise<SchedulerResult> => {
            const scenesToPlace = scoredScenes.map(scene => { return new ScheduleScene(JSON.parse(JSON.stringify(scene)), cache); });
            const schedule = new Schedule(eventId, scenes, cache);
            schedulerStatuses[schedulerIdx] = {scheduler: 'running', scenes:{}};

            schedule.on('scene status', (data) => {
                schedulerStatuses[schedulerIdx].scenes[data.sceneId] = data.status;
            });
            /*
                if (((new Date).getTime() - lastStatusSent) > 100){
                    this.sendData({
                        type: 'scene status',
                        scenes: scenesToPlace.length,
                        runs: runs,
                        status: formatScheduleStatus(schedulerStatuses)
                    });
                    lastStatusSent = (new Date).getTime();
                }
            }); */

            schedule.on('status', data => {
                this.sendData({
                    type:'status',
                    message:data.message
                });
            });

            schedule.on('error', (err) => {
                throw new Error(err.message);
            });
            await schedule.run(scenesToPlace, options, schedulerIdx);
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
        this.sendData({
            type: 'scheduler status',
            message: `Scheduler complete for event id:${this.event_id}: ${schedule.happiness} / ${happyAvg}`
        });
        this.sendData({
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
        clearInterval(keepalive);
        clearInterval(statusSend);
        this.sendData(null);
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
            const id = getReqId(prereq);
            const prereqScene = _.findWhere(scenes, {id:id});
            if (!prereqScene){ continue; }
            if (!_.has(prereqScene, 'prereq_of')){
                prereqScene.prereq_of = []
            }
            prereqScene.prereq_of.push(scene.id);
        }

        for (const coreq of scene.coreqs){
            const id = getReqId(coreq);
            const coreqScene = _.findWhere(scenes, {id:id});
            if (!coreqScene){ continue; }
            if (!_.has(coreqScene, 'coreq_of')){
                coreqScene.coreq_of = []
            }
            coreqScene.coreq_of.push(scene.id);
        }

    }

    return _.sortBy(scenes, 'score').reverse();
}

function getReqId(prereq:string|number|SceneModel):number{
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
                const prereqId = getReqId(prereq);
                const prereqScene = _.findWhere(scenes, {id:prereqId});
                if (prereqScene && (scene.score >= prereqScene.score)){

                    prereqScene.score = scene.score + 1;
                }
            }

            for (const coreq of scene.coreqs){
                const coreqId = getReqId(coreq);
                const coreqScene = _.findWhere(scenes, {id:coreqId});
                if (coreqScene && (scene.score >= coreqScene.score)){
                    coreqScene.score = scene.score;
                }
            }

            return scene;
        })

    return scenes;
}

function scoreScene(scene:SceneModel): SceneModel{
    scene.score = 0;

    scene.score += (scene.locations_count * Number(config.get('scheduler.score.locations_count')));
    scene.score -= scene.locations.filter(location => {
        if (location.scene_request_status === 'rejected') { return false;}
        if (location.scene_request_status === 'none') { return false;}
        return true;
    }).length;

    scene.score += (scene.timeslot_count * Number(config.get('scheduler.score.timeslot_count')));
    scene.score += scene.setup_slots * Number(config.get('scheduler.score.timeslot_count'));
    scene.score += scene.cleanup_slots * Number(config.get('scheduler.score.timeslot_count'));
    scene.score -= scene.timeslots.filter(timeslot => {
        if (timeslot.scene_request_status === 'rejected') { return false;}
        if (timeslot.scene_request_status === 'none') { return false;}
        return true;
    }).length;

    scene.score += scene.users.filter(user => {
        return user.scene_request_status === 'required'
    }).length;

    scene.score += scene.player_count_max;
    scene.score += scene.staff_count_max;

    return scene;
}



export default AutoScheduler;
