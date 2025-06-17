'use strict';
import _ from 'underscore';
import async from 'async';
import models from './models';
import scheduleHelper from './scheduleHelper';

async function scoreScenes(scenes){
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

export default {
    scoreScenes
};
