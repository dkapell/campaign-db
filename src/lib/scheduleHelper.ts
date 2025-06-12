'use strict';
import _ from 'underscore';
import models from './models';
import async from 'async';

async function validateScene(scene:SceneModel): Promise<SceneWarnings> {
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
            let prereqScene = null;
            if (typeof prereq === 'string'){
                continue;
            } else if (typeof prereq === 'number'){
                prereqScene = await models.scene.get(prereq);
            } else {
                prereqScene = await models.scene.get(prereq.id);
            }

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
    const userCounts = {
        players: {
            confirmed:0,
            suggested:0,
            total:0
        },
        staff: {
            confirmed:0,
            suggested:0,
            total:0
        }
    };

    for (const user of scene.users){
        if (user.scene_schedule_status === 'confirmed'){
            if (user.type==='player'){
                userCounts.players.confirmed++;
            } else {
                userCounts.staff.confirmed++;
            }
        } else if (user.scene_schedule_status === 'suggested'){
            if (user.type==='player'){
                userCounts.players.suggested++;
            } else {
                userCounts.staff.suggested++;
            }
        }
        if (user.scene_schedule_status === 'confirmed' || user.scene_schedule_status === 'suggested'){
            for (const timeslot of timeslots.timeslots){
                const concurentScenes = allScenes.filter(checkScene => {
                    if (checkScene.id === scene.id){
                        return false
                    }
                    const checkTimeslots = getSelectedTimeslots(checkScene);
                    if (_.findWhere(checkTimeslots.timeslots, {id:timeslot.id})){
                        return true;
                    }
                    return false;
                });

                //const scenes = await getScenesAtTimeslot(scene.event_id, timeslot.id);
                for (const timeslotScene of concurentScenes){
                    const timeslotSceneUser = _.findWhere(timeslotScene.users, {id:user.id});
                    if (!timeslotSceneUser){
                        continue
                    }
                    if (timeslotSceneUser.scene_schedule_status === 'confirmed'){
                        if (user.type === 'player'){
                            issues.warning.push(`${user.name} is also booked for ${timeslotScene.name}`);
                        } else {
                            issues.info.push(`${user.name} is also booked for ${timeslotScene.name}`);
                        }
                    } else if (timeslotSceneUser.scene_schedule_status === 'suggested'){
                        if (user.type === 'player'){
                            issues.warning.push(`${user.name} is also suggested for ${timeslotScene.name}`);
                        } else {
                            issues.info.push(`${user.name} is also suggested for ${timeslotScene.name}`);
                        }
                    }
                }

                const schedule_busys = await models.schedule_busy.find({event_id:scene.event_id, user_id:user.id, timeslot_id:timeslot.id});
                if (schedule_busys.length){
                    issues.warning.push(`${user.name} is also busy with ${(_.pluck(schedule_busys, 'name')).join(', ')}`);
                }
            }
        }
    }
    userCounts.players.total = userCounts.players.confirmed + userCounts.players.suggested;
    userCounts.staff.total = userCounts.staff.confirmed + userCounts.staff.suggested;
    if (userCounts.players.total < scene.player_count_min){
        issues.warning.push('Not enough Players');
    } else if (userCounts.players.total > scene.player_count_max){
        issues.warning.push('Too many Players');
    }
    if (userCounts.players.suggested){
        issues.info.push('Unconfirmed Players');
    }

    if (userCounts.staff.total < scene.staff_count_min){
        issues.warning.push('Not enough Staff');
    } else if (userCounts.staff.total > scene.staff_count_max){
        issues.warning.push('Too many Staff');
    }
    if (userCounts.staff.suggested){
        issues.info.push('Unconfirmed Staff');
    }
    return issues;
}

function getSelectedTimeslots(scene:SceneModel): {type:string, timeslots:TimeslotModel[]}{
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

function getSelectedLocations(scene:SceneModel): {type:string, locations:LocationModel[]}{
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

function formatScene(scene:SceneModel): FormattedSceneModel{
    const output: FormattedSceneModel = {
        id:scene.id,
        campaign_id: scene.campaign_id,
        name: scene.name,
        player_name:scene.player_name,
        event_id: scene.event_id,
        event: scene.event,
        status: scene.status,
        description: scene.description,
        display_to_pc: scene.display_to_pc,
        player_count_min: scene.player_count_min,
        player_count_max: scene.player_count_max,
        staff_count_min: scene.staff_count_min,
        staff_count_max: scene.staff_count_max,
        combat_staff_count_min: scene.combat_staff_count_min,
        combat_staff_count_max: scene.combat_staff_count_max,
        timeslot_count: scene.timeslot_count,
        locations_count: scene.locations_count,
        staff_url: scene.staff_url,
        player_url: scene.player_url,
        tags: _.pluck(scene.tags, 'name')
    };

    if (scene.prereqs && typeof scene.prereqs !== 'string'){
        output.prereqs = scene.prereqs.map((prereq:SceneModel)=> {
            if (typeof prereq === 'object'){
                return {
                    id: prereq.id,
                    name: prereq.name,
                    status: prereq.status,
                    event: typeof prereq.event === 'object'?prereq.event.name:null,
                    event_id: prereq.event_id
                }
            } else {
                return prereq;
            }
        });
    }
    const locations = scene.locations.map(location => {
        return {
            id: location.id,
            name: location.name,
            tags: _.pluck(location.tags, 'name'),
            combat: location.combat,
            multiple: location.multiple,
            scene_schedule_status: location.scene_schedule_status,
            scene_request_status: location.scene_request_status,
        }
    });
    output.locations = _.groupBy(locations, 'scene_schedule_status');

    const timeslots = scene.timeslots.map(timeslot => {
        return {
            id: timeslot.id,
            name: timeslot.name,
            type: timeslot.type,
            scene_schedule_status: timeslot.scene_schedule_status,
            scene_request_status: timeslot.scene_request_status,
        }
    })
    output.timeslots = _.groupBy(timeslots, 'scene_schedule_status');

    const sources = scene.sources.map(source => {
        return {
            id: source.id,
            name: source.name,
            type: source.type.name,
            scene_schedule_status: source.scene_schedule_status,
            scene_request_status: source.scene_request_status,
        };

    });
    output.sources = _.groupBy(sources, 'scene_schedule_status');

    const players = scene.users.filter(user => {
        return user.type === 'player';
    }).map(user => {
        const doc = {
            id: user.id,
            name: user.name,
            email: user.email,
            character: null,
            type: user.type,
            tags: _.pluck(user.tags, 'name'),
            scene_schedule_status: user.scene_schedule_status,
            scene_request_status: user.scene_request_status,
        }
        if (user.character){
            doc.character = {
                id: user.character.id,
                name: user.character.name
            }
        }
        return doc;
    });
    output.players = _.groupBy(players, 'scene_schedule_status');

    const staff = scene.users.filter(user => {
        return user.type !== 'player';
    }).map(user => {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            type: user.type,
            tags: _.pluck(user.tags, 'name'),
            scene_schedule_status: user.scene_schedule_status,
            scene_request_status: user.scene_request_status,
        }
    });
    output.staff = _.groupBy(staff, 'scene_schedule_status');
    output.users = [...players, ...staff];
    output.usersByStatus = _.groupBy(scene.users, 'scene_schedule_status');

    if (scene.event){
        if (typeof scene.event !== 'string'){
            output.event = {
                id: scene.event_id,
                name: scene.event.name,
                start_time: scene.event.start_time,
                end_time: scene.event.end_time
            };
        }
    }
    return output;
}

function formatUser(user){
    const doc = {
        id:user.id,
        name: user.name,
        character: null,
        email: user.email,
        type: user.type,
        tags: _.pluck(user.tags, 'name'),
        typeForDisplay: user.typeForDisplay,
        schedule_status: user.schedule_status,
        schedule_scene_id: user.schedule_scene_id,
        busy: user.busy
    };
    if (user.character){
        doc.character = {
            id: user.character.id,
            name: user.character.name
        }
    }
    return doc;
}

async function getEventUsers(eventId:number): Promise<CampaignUser[]>{
    const event = await models.event.get(eventId);
    const attendances = await models.attendance.find({event_id:eventId, attending:true});
    return async.map(attendances, async(attendance) => {
        const user = await models.user.get(event.campaign_id, attendance.user_id);
        if (user.type === 'player'){
            user.character = await models.character.findOne({campaign_id:event.campaign_id, user_id:user.id, active:true});
        }
        return user;
    });
}

async function getEventScenes(eventId:number): Promise<FormattedSceneModel[]>{
    const scenes = await models.scene.find({event_id:eventId});

    return scenes.map(formatScene);
}

async function getScenesAtTimeslot(eventId:number, timeslotId:number): Promise<FormattedSceneModel[]>{
    const scenes = await getEventScenes(eventId)
    return async.filter(scenes, async(scene) => {
        if (_.findWhere(scene.timeslots.confirmed, {id:timeslotId})){
            return true;
        } else if (_.findWhere(scene.timeslots.suggested, {id:timeslotId})){
            return true;
        }
        return false;
    });
}

async function getUsersAtTimeslot(eventId:number, timeslotId:number): Promise<CampaignUser[]>{
    const users = await getEventUsers(eventId);
    const scenes = await getScenesAtTimeslot(eventId, timeslotId);

    return async.map(users, async(user) => {
        const statuses = [];

        for (const scene of scenes){
            if (scene.usersByStatus && _.findWhere(scene.usersByStatus.confirmed, {id:user.id})){
                const record = _.findWhere(scene.usersByStatus.confirmed, {id:user.id});
                statuses.push({type:'scene', sceneId:scene.id, status:record.scene_schedule_status});
            } else if (scene.usersByStatus && _.findWhere(scene.usersByStatus.suggested, {id:user.id})){
                const record = _.findWhere(scene.usersByStatus.suggested, {id:user.id});
                statuses.push({type: 'scene', sceneId:scene.id, status:record.scene_schedule_status});
            }
        }

        const schedule_busys = await models.schedule_busy.find({
            event_id: eventId,
            user_id: user.id,
            timeslot_id: timeslotId
        })

        for (const schedule_busy of schedule_busys){
            statuses.push({type: 'busy', name:schedule_busy.type.name, status:'scheduled'})
        }

        if (!statuses.length){
            user.schedule_status = 'unscheduled';
        } else if (statuses.length === 1){
            user.schedule_status = statuses[0].status;
            if (statuses[0].type === 'scene'){
                user.schedule_scene_id = [statuses[0].sceneId];
                user.busy = [];
            } else {
                user.schedule_scene_id = null;
                user.busy = [statuses[0].name];
            }
        } else {
            user.schedule_status = 'multi-booked';
            user.schedule_scene_id = _.pluck(_.where(statuses, {type:'scene'}), 'sceneId')
            user.busy = _.pluck(_.where(statuses, {type:'busy'}), 'name')
        }
        return user;
    });
}

export default {
    validateScene,
    formatScene,
    formatUser,
    getEventUsers,
    getEventScenes,
    getScenesAtTimeslot,
    getUsersAtTimeslot
};
