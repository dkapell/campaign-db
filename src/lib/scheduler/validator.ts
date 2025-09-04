'use strict';
import _ from 'underscore';
import models from '../models';
import async from 'async';

const issueList = {
    'dbl-book': 'warning',
    'dbl-book-setup': 'info',
    'rej-location': 'warning',
    'non-req-location': 'info',
    'rej-timeslot': 'warning',
    'non-req-timeslot': 'info',
    'prereq-not-sched': 'info',
    'prereq-diff-event': 'info',
    'prereq-after': 'warning',
    'player-dbl-book': 'warning',
    'staff-dbl-book': 'warning',
    'user-dbl-busy': 'warning',
    'not-enough-players': 'warning',
    'too-many-players': 'warning',
    'unconfirmed-players': 'info',
    'not-enough-staff': 'warning',
    'too-many-staff': 'warning',
    'unconfirmed-staff': 'info',
    'missing-req-user': 'warning',
    'missing-req-attendee': 'warning',
    'missing-attendee': 'warning',
    'missing-runner': 'warning',
    'coreq-not-sched': 'info',
    'coreq-diff-event': 'info',
    'coreq-diff-time': 'warning'
}

interface IssueRecord{
    code: string,
    text: string
}

async function validateScene(scene:SceneModel, data:ValidationCache = {}): Promise<SceneIssueModel[]> {
    const issues: IssueRecord[] = [];
    if (!scene.event_id || scene.status === 'new' || scene.status === 'postponed'){
        return [];
    }

    const locations = getSelectedLocations(scene);
    const timeslots = getSceneTimeslots(scene);
    if (!_.has(data, 'scenes')){
        data.scenes = await models.scene.find({event_id:scene.event_id});
    }

    if (!_.has(data, 'timeslots')){
        data.timeslots = await models.timeslot.find({campaign_id:scene.campaign_id});
    }

    if (!_.has(data, 'data.attendees')){
        data.attendees = await models.attendance.find({event_id:scene.event_id, attending:true});
    }

    if (!_.has(data, 'schedule_busys')){
        data.schedule_busys = await models.schedule_busy.find({event_id:scene.event_id});
    }

    const reservedTimeslots = await getReservedSceneTimeslots(scene, data.timeslots);

    for (const checkScene of data.scenes){
        if (checkScene.id === scene.id){
            continue;
        }
        const checkLocations = getSelectedLocations(checkScene);
        const checkTimeslots = getSceneTimeslots(checkScene);
        const checkReservedTimeslots = await getReservedSceneTimeslots(checkScene, data.timeslots);

        for (const timeslot of checkTimeslots.timeslots){
            if (_.findWhere(timeslots.timeslots, {id:timeslot.id})){
                for (const location of checkLocations.locations){
                    if (_.findWhere(locations.locations, {id:location.id})){
                        if (!location.multiple_scenes){
                            issues.push({
                                code: 'dbl-book',
                                text: `Double-booked with ${checkScene.name} in ${location.name}`
                            });
                        }
                    }
                }

            } else if (_.findWhere(reservedTimeslots.timeslots, {id:timeslot.id})){
                for (const location of checkLocations.locations){
                    if (_.findWhere(locations.locations, {id:location.id})){
                        if (!location.multiple_scenes){
                            issues.push({
                                code: 'dbl-book-setup',
                                text: `Double-booked for Setup/Cleanup with ${checkScene.name} in ${location.name}`
                            });
                        }
                    }
                }

            }
        }

        for (const timeslot of checkReservedTimeslots.timeslots){
            if (_.findWhere(timeslots.timeslots, {id:timeslot.id})){
                for (const location of checkLocations.locations){
                    if (_.findWhere(locations.locations, {id:location.id})){
                        if (!location.multiple_scenes){
                            issues.push({
                                code: 'dbl-book-setup',
                                text: `Double-booked for Setup/Cleanup with ${checkScene.name} in ${location.name}`
                            });
                        }
                    }
                }

            } else if (_.findWhere(reservedTimeslots.timeslots, {id:timeslot.id})){
                for (const location of checkLocations.locations){
                    if (_.findWhere(locations.locations, {id:location.id})){
                        if (!location.multiple_scenes){
                            issues.push({
                                code: 'dbl-book',
                                text: `Double-booked with ${checkScene.name} in ${location.name}`
                            });
                        }
                    }
                }

            }
        }
    }

    for (const location of locations.locations){
        switch (location.scene_request_status){
            case 'rejected':
                issues.push({
                    code: 'rej-location',
                    text: `Scheduled for a rejected location: ${location.name}`
                });
                break;
            case 'requested':
            case 'required':
                break
            default:
                issues.push({
                    code: 'non-req-location',
                    text: `Scheduled for a non-requested location: ${location.name}`
                });
                break;
        }
    }
    for (const timeslot of timeslots.timeslots){
        switch (timeslot.scene_request_status){
            case 'rejected':
                issues.push({
                    code: 'rej-timeslot',
                    text: `Scheduled for a rejected timeslot: ${timeslot.name}`
                });
                break;
            case 'requested':
            case 'required':
                break
            default:
                issues.push({
                    code: 'non-req-timeslot',
                    text: `Scheduled for a non-requested timeslot: ${timeslot.name}`
                });
                break;
        }
    }

    if (timeslots.timeslots.length){
        const myTimeslotIdx = _.findIndex(data.timeslots, {id: timeslots.timeslots[0].id});

        for (const prereq of scene.prereqs){
            let prereqScene = null;
            if (typeof prereq === 'string'){
                continue;
            } else if (typeof prereq === 'number'){
                prereqScene = _.findWhere(data.scenes, {id:prereq});
                if (!prereqScene){
                    prereqScene = await models.scene.get(prereq);
                }
            } else {
                prereqScene = _.findWhere(data.scenes, {id:prereq.id});
                if (!prereqScene){
                    prereqScene = await models.scene.get(prereq.id);
                }
            }

            if (!prereqScene.event_id || prereqScene.status === 'ready'){
                issues.push({
                    code: 'prereq-not-sched',
                    text: `Prereq ${prereqScene.name} is not scheduled`
                });
            } else if (prereqScene.event_id !== scene.event_id){
                issues.push({
                    code: 'prereq-diff-event',
                    text: `Prereq ${prereqScene.name} is scheduled for a different event`
                });
            } else {
                const prereqTimeslots = getSceneTimeslots(prereqScene);
                const prereqTimeslotIdx = _.findIndex(data.timeslots, {id: prereqTimeslots.timeslots[0].id});
                if (prereqTimeslotIdx >= myTimeslotIdx){
                    issues.push({
                        code: 'prereq-after',
                        text: `Prereq ${prereqScene.name} is scheduled after this scene`
                    });
                }
            }
        }

        for (const coreq of scene.coreqs){
            let coreqScene = null;
            if (typeof coreq === 'string'){
                continue;
            } else if (typeof coreq === 'number'){
                coreqScene = _.findWhere(data.scenes, {id:coreq});
                if (!coreqScene){
                    coreqScene = await models.scene.get(coreq);
                }
            } else {
                coreqScene = _.findWhere(data.scenes, {id:coreq.id});
                if (!coreqScene){
                    coreqScene = await models.scene.get(coreq.id);
                }
            }

            if (!coreqScene.event_id || coreqScene.status === 'ready'){
                issues.push({
                    code: 'coreq-not-sched',
                    text: `Co-req ${coreqScene.name} is not scheduled`
                });
            } else if (coreqScene.event_id !== scene.event_id){
                issues.push({
                    code: 'coreq-diff-event',
                    text: `Co-req ${coreqScene.name} is scheduled for a different event`
                });
            } else {
                const coreqTimeslots = getSceneTimeslots(coreqScene);
                const coreqTimeslotIdx = _.findIndex(data.timeslots, {id: coreqTimeslots.timeslots[0].id});
                if (coreqTimeslotIdx !== myTimeslotIdx){
                    issues.push({
                        code: 'coreq-diff-time',
                        text: `Co-req ${coreqScene.name} is scheduled at a different time`
                    });
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
            if (!(user.type === 'player' && scene.non_exclusive)){
                for (const timeslot of timeslots.timeslots){
                    const concurentScenes = data.scenes.filter(checkScene => {
                        if (checkScene.id === scene.id){
                            return false
                        }
                        const checkTimeslots = getSceneTimeslots(checkScene);
                        if (_.findWhere(checkTimeslots.timeslots, {id:timeslot.id})){
                            return true;
                        }
                        return false;
                    });

                    for (const timeslotScene of concurentScenes){
                        const timeslotSceneUser = _.findWhere(timeslotScene.users, {id:user.id});
                        if (!timeslotSceneUser){
                            continue
                        }

                        if (timeslotSceneUser.scene_schedule_status === 'confirmed'){
                            if (user.type === 'player'){
                                 if (!timeslotScene.non_exclusive){
                                    issues.push({
                                        code: 'player-dbl-book',
                                        text: `${user.name} is also booked for ${timeslotScene.name}`
                                    });
                                }
                            } else {
                                issues.push({
                                    code: 'staff-dbl-book',
                                    text: `${user.name} is also booked for ${timeslotScene.name}`
                                });
                            }
                        } else if (timeslotSceneUser.scene_schedule_status === 'suggested'){
                            if (user.type === 'player'){
                                if (!timeslotScene.non_exclusive){
                                    issues.push({
                                        code: 'player-dbl-book',
                                        text: `${user.name} is also suggested for ${timeslotScene.name}`
                                    });
                                }
                            } else {
                                issues.push({
                                    code: 'staff-dbl-book',
                                    text: `${user.name} is also suggested for ${timeslotScene.name}`
                                });
                            }
                        }
                    }

                    const schedule_busys = _.where(data.schedule_busys, {user_id:user.id, timeslot_id:timeslot.id})
                    if (schedule_busys.length){
                        issues.push({
                            code: 'user-dbl-busy',
                            text: `${user.name} is also busy with ${(_.pluck(schedule_busys, 'name')).join(', ')}`
                        });
                    }
                }
            }
        }
    }

    userCounts.players.total = userCounts.players.confirmed + userCounts.players.suggested;
    userCounts.staff.total = userCounts.staff.confirmed + userCounts.staff.suggested;
    if (scene.assign_players && userCounts.players.total < scene.player_count_min && !scene.for_anyone){
        issues.push({
            code: 'not-enough-players',
            text: 'Not enough Players'
        });
    } else if (scene.assign_players && userCounts.players.total > scene.player_count_max){
        issues.push({
            code: 'too-many-players',
            text: 'Too many Players'
        });
    }
    if (scene.assign_players && userCounts.players.suggested){
        issues.push({
            code: 'unconfirmed-players',
            text: 'Unconfirmed Players'
        });
    }

    if (userCounts.staff.total < scene.staff_count_min){
        issues.push({
            code: 'not-enough-staff',
            text: 'Not enough Staff'
        });
    } else if (userCounts.staff.total > scene.staff_count_max){
        issues.push({
            code: 'too-many-staff',
            text: 'Too many Staff'
        });
    }
    if (userCounts.staff.suggested){
        issues.push({
            code: 'unconfirmed-staff',
            text: 'Unconfirmed Staff'
        });
    }

    for (const user of scene.users){
        const attendance = _.findWhere(data.attendees, {user_id:user.id});
        if (user.scene_request_status === 'required' && !user.scene_schedule_status.match(/^(suggested|confirmed)$/)){
            if (!attendance || !attendance.attending){
                issues.push({
                    code: 'missing-req-attendee',
                    text: `${user.name} is required, but not attending this event`
                });
            } else {
                issues.push({
                    code: 'missing-req-user',
                    text: `${user.name} is required, but not assigned`
                });
            }
        } else if ((!attendance || !attendance.attending) && user.scene_schedule_status.match(/^(suggested|confirmed)$/)){
            issues.push({
                code: 'missing-attendee',
                text: `${user.name} is assigned, but not attending this event`
            });
        }

    }

    if (scene.runner_id){
        const sceneUser = _.findWhere(scene.users, {id:scene.runner_id});
        if (!sceneUser || !sceneUser.scene_schedule_status.match(/^(confirmed|suggested)$/)){
            issues.push({
                code: 'missing-runner',
                text: `${scene.runner.name} is running this scene, but not assigned to it.`
            });
        }
    }

    await saveSceneIssues(scene.id, issues);

    return models.scene_issue.find({scene_id:scene.id, resolved:false});
}


async function saveSceneIssues(sceneId:number, issues: IssueRecord[]){
    const currentIssues: SceneIssueModel[] = await models.scene_issue.find({scene_id:sceneId});

    await async.each(currentIssues, async(issue)=>{
        if (_.findWhere(issues, {code:issue.code, text:issue.text})){
            return;
        }
        if (issue.ignored){
            issue.resolved = true;
            return models.scene_issue.update(issue.id, issue);
        } else {
            return models.scene_issue.delete(issue.id);
        }
    });

    await async.each(issues, async(issue) => {
        if (!_.has(issueList, issue.code)){
            return;
        }
        const current = _.findWhere(currentIssues, {code:issue.code, text:issue.text});
        if (current){
            if (!current.resolved){
                return;
            } else {
                current.resolved = false;
                return models.scene_issue.update(current.id, current);
            }
        }
        return models.scene_issue.create({
            scene_id: sceneId,
            code: issue.code,
            level: issueList[issue.code],
            text: issue.text
        });
    });
}

async function getFullSceneTimeslots(scene:SceneModel): Promise<{type:string, timeslots:TimeslotModel[]}>{
    const allTimeslots = await models.timeslot.find({campaign_id:scene.campaign_id});

    const timeslots = getSceneTimeslots(scene);
    if (timeslots.type === 'none'){
        return timeslots;
    }
    const timeslotList = [];

    const sceneTimeslotIndexes = []

    for ( const timeslot of timeslots.timeslots){
        sceneTimeslotIndexes.push(_.indexOf(_.pluck(allTimeslots, 'id'), timeslot.id));
    }
    const firstSlotIdx = _.min(sceneTimeslotIndexes);
    const firstSetupIdx = _.max([0, firstSlotIdx - scene.setup_slots]);
    for (let i = firstSetupIdx; i < firstSlotIdx; i++){
        timeslotList.push(allTimeslots[i]);
    }
    for (const timeslotIdx of sceneTimeslotIndexes){
        timeslotList.push(allTimeslots[timeslotIdx]);
    }
    const lastSlotIdx = _.max(sceneTimeslotIndexes);
    const lastCleanupIdx = _.min([allTimeslots.length, lastSlotIdx + scene.cleanup_slots +1])
    for (let i = lastSlotIdx+1; i < lastCleanupIdx; i++){
        timeslotList.push(allTimeslots[i]);
    }

    timeslots.timeslots = timeslotList;
    return timeslots;

}


async function getReservedSceneTimeslots(scene:SceneModel, allTimeslots:TimeslotModel[]): Promise<{type:string, timeslots:TimeslotModel[]}>{

    const timeslots = getSceneTimeslots(scene);
    if (timeslots.type === 'none'){
        return timeslots;
    }
    const timeslotList = [];

    const sceneTimeslotIndexes = []

    for ( const timeslot of timeslots.timeslots){
        sceneTimeslotIndexes.push(_.indexOf(_.pluck(allTimeslots, 'id'), timeslot.id));
    }
    const firstSlotIdx = _.min(sceneTimeslotIndexes);
    const firstSetupIdx = _.max([0, firstSlotIdx - scene.setup_slots]);
    for (let i = firstSetupIdx; i < firstSlotIdx; i++){
        timeslotList.push(allTimeslots[i]);
    }

    const lastSlotIdx = _.max(sceneTimeslotIndexes);
    const lastCleanupIdx = _.min([allTimeslots.length, lastSlotIdx + scene.cleanup_slots +1])
    for (let i = lastSlotIdx+1; i < lastCleanupIdx; i++){
        timeslotList.push(allTimeslots[i]);
    }

    timeslots.timeslots = timeslotList;
    return timeslots;

}
function getSceneTimeslots(scene: SceneModel): {type:string, timeslots:TimeslotModel[]}{

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
export default validateScene;
