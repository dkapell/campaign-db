'use strict';
import _ from 'underscore';
import async from 'async';
import models from './models';
import scheduleHelper from './scheduleHelper';

function scoreScenes(scenes){
    scenes = scenes.map(scoreScene)
        .map(scene => {
            for (const prereq of scene.prereqs){
                let prereqId:number = null;
                if (typeof prereq === 'number'){
                    prereqId = prereql
                } else {
                    prereqId = prereq.id;
                }
                const prereqScene = _.findWhere(scenes, {id:prereqId});
                if (prereqScene && (scene.score >= prereqScene.score)){
                    scene.score = prereqScene.score - 1;
                }
            }
            return scene;
        })
        .map(scene => {
            return scheduleHelper.formatScene(scene);
        });

    scenes = _.sortBy(scenes, 'score').reverse();

    return scenes;
}

function scoreScene(scene){
    scene.score = 0;
    scene.score += scene.locations_count * 2;
    scene.score -= scene.locations.filter(location => {
        return location.scene_request_status !== 'none';
    }).length;
    scene.score += scene.timeslot_count * 3;
    scene.score -= scene.timeslots.filter(timeslot => {
        return timeslot.scene_request_status !== 'none';
    }).length;
    scene.score += scene.player_count_max;
    scene.score += scene.staff_count_max;

    return scene;
}

async function runScheduler(eventId, scenes){
    const event = await models.event.get(eventId);
    scenes = scoreScenes(scenes);
    const schedule = await scheduleHelper.getEventSchedule(eventId);
    for (const scene of scenes){
        findSlot(scene, schedule);
    }
    return schedule;
}

function findSlot(scene, schedule){
    let found = false;
    if (scene.timeslots.suggested){

    }
    if (!found && scene.timeslots.required){
        for (const timeslot of scene.timeslots.required){
            const location = checkSlotLocation(timeslot.id, schedule);
            if (location){
                found = true;
                scheduleScene(schedule, scene, {timeslot: timeslot.id, location: location.id});
            }
        }

    }
    if (!found && scene.timeslots.requested){

    }

    if (!found){
        console.log(`${scene.name} has no timeslots`);
        return;
    }
}

function scheduleScene(schedule, scene, data){

    for (const timeslot of schedule){
        //const currentScene =
    }
}

export default {
    scoreScenes,
    run: runScheduler
};
