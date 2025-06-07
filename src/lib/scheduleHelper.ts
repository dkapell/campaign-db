'use strict';
import _ from 'underscore';
import models from './models';
import async from 'async';

async function validateScene(scene){
    const issues = {
        warning: [],
        info: []
    }
    if (!scene.event_id || scene.status === 'new' || scene.status === 'postponed'){
        return issues;
    }
    const allScenes = await models.scene.find({event_id:scene.event_id});

    const locations = getSelectedLocations(scene);
    const timeslots = getSelectedTimeslots(scene);
    for (const checkScene of allScenes){
        if (checkScene.id === scene.id){
            continue;
        }
        const checkLocations = getSelectedLocations(checkScene);
        const checkTimeslots = getSelectedTimeslots(checkScene);
        for (const timeslot of checkTimeslots.timeslots){
            if (_.findWhere(timeslots.timeslots, {id:timeslot.id})){
                for (const location of checkLocations.locations){
                    if (_.findWhere(locations.locations, {id:location.id})){
                        if (!location.multiple_scenes){
                            issues.warning.push(`Double-booked with ${checkScene.name} in ${location.name}`);
                        }
                    }
                }

            }
        }
    }
    for (const location of locations.locations){
        switch (location.scene_request_status){
            case 'rejected':
                issues.warning.push(`Scheduled for a rejected location: ${location.name}`);
                break;
            case 'requested':
            case 'required':
                break
            default:
                issues.info.push(`Scheduled for a non-requested location: ${location.name}`);
                break;
        }
    }

    for (const timeslot of timeslots.timeslots){
        switch (timeslot.scene_request_status){
            case 'rejected':
                issues.warning.push(`Scheduled for a rejected timeslot: ${timeslot.name}`);
                break;
            case 'requested':
            case 'required':
                break
            default:
                issues.info.push(`Scheduled for a non-requested timeslot: ${timeslot.name}`);
                break;
        }
    }
    if (timeslots.timeslots.length){
        const allTimeslots = await models.timeslot.find({campaign_id:scene.campaign_id});
        const myTimeslotIdx = _.findIndex(allTimeslots, {id: timeslots.timeslots[0].id});
        for (const prereq of scene.prereqs){
            const prereqScene = await models.scene.get(prereq.id);
            if (!prereqScene.event_id || prereqScene.status === 'ready'){
                issues.info.push(`Prereq ${prereqScene.name} is not scheduled`);
            } else if (prereqScene.event_id !== scene.event_id){
                issues.info.push(`Prereq ${prereqScene.name} is scheduled for a different event`);
            } else {
                const prereqTimeslots = getSelectedTimeslots(prereqScene);
                const prereqTimeslotIdx = _.findIndex(allTimeslots, {id: prereqTimeslots.timeslots[0].id});
                if (prereqTimeslotIdx >= myTimeslotIdx){
                    issues.warning.push(`Prereq ${prereqScene.name} is scheduled after this scene`);
                }
            }
        }
    }

    // Check for double-booked people (w for player, i for staff)
    return issues;

}

function getSelectedTimeslots(scene){
    let timeslots = scene.timeslots.filter(timeslot => {
        return timeslot.scene_schedule_status === 'confirmed'
    });
    if (timeslots.length){
        return {type:'confirmed', timeslots:timeslots};
    }
    timeslots = scene.timeslots.filter(timeslot => {
        return timeslot.scene_schedule_status === 'suggested'
    });
    if (timeslots.length){
        return {type:'suggested', timeslots:timeslots};
    }
    return {type:'none', timeslots:[]};
}

function getSelectedLocations(scene){
    let locations = scene.locations.filter(location => {
        return location.scene_schedule_status === 'confirmed'
    });
    if (locations.length){
        return {type:'confirmed', locations:locations};
    }
    locations = scene.locations.filter(location => {
        return location.scene_schedule_status === 'suggested'
    });
    if (locations.length){
        return {type:'suggested', locations:locations};
    }
    return {type:'none', locations:[]};
}

export default {
    validateScene
};
