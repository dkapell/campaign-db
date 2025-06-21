'use strict';
import _ from 'underscore';
import models from '../models';
import async from 'async';

const issueList = {
    'dbl-book': 'warning',
    'rej-location': 'warning',
    'non-req-location': 'info',
    'rej-timeslot': 'warning',
    'non-req-timeslot': 'info',
    'prereq-not-sched': 'info',
    'prereq-diff-event': 'info',
    'prereq-after': 'warning',
    'player-dbl-book': 'warning',
    'staff-dbl-book': 'info',
    'user-dbl-busy': 'warning',
    'not-enough-players': 'warning',
    'too-many-players': 'warning',
    'unconfirmed-players': 'info',
    'not-enough-staff': 'warning',
    'too-many-staff': 'warning',
    'unconfirmed-staff': 'info'
}

interface IssueRecord{
    code: string,
    text: string
}

async function validateScene(scene:SceneModel, eventScenes:SceneModel[] = []): Promise<SceneIssueModel[]> {
    let time = (new Date()).getTime()
    const issues: IssueRecord[] = [];
    console.log(`working on ${scene.name}`)
    if (!scene.event_id || scene.status === 'new' || scene.status === 'postponed'){
        return [];
    }
    if (!eventScenes){
        eventScenes = await models.scene.find({event_id:scene.event_id});
    }
    const locations = getSelectedLocations(scene);
    const timeslots = getSelectedTimeslots(scene);

    for (const checkScene of eventScenes){
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
    console.log(`0: ${(new Date()).getTime() - time}`); time = (new Date()).getTime();
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
                issues.push({
                    code: 'prereq-not-sched',
                    text: `Prereq ${prereqScene.name} is not scheduled`
                });
            } else if (prereqScene.event_id !== scene.event_id){
                issues.push({
                    code: 'prereq-dif-event',
                    text: `Prereq ${prereqScene.name} is scheduled for a different event`
                });
            } else {
                const prereqTimeslots = getSelectedTimeslots(prereqScene);
                const prereqTimeslotIdx = _.findIndex(allTimeslots, {id: prereqTimeslots.timeslots[0].id});
                if (prereqTimeslotIdx >= myTimeslotIdx){
                    issues.push({
                        code: 'prereq-after',
                        text: `Prereq ${prereqScene.name} is scheduled after this scene`
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
            for (const timeslot of timeslots.timeslots){
                const concurentScenes = eventScenes.filter(checkScene => {
                    if (checkScene.id === scene.id){
                        return false
                    }
                    const checkTimeslots = getSelectedTimeslots(checkScene);
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
                            issues.push({
                                code: 'player-dbl-book',
                                text: `${user.name} is also booked for ${timeslotScene.name}`
                            });
                        } else {
                            issues.push({
                                code: 'staff-dbl-book',
                                text: `${user.name} is also booked for ${timeslotScene.name}`
                            });
                        }
                    } else if (timeslotSceneUser.scene_schedule_status === 'suggested'){
                        if (user.type === 'player'){
                            issues.push({
                                code: 'player-dbl-book',
                                text: `${user.name} is also suggested for ${timeslotScene.name}`
                            });
                        } else {
                            issues.push({
                                code: 'staff-dbl-book',
                                text: `${user.name} is also suggested for ${timeslotScene.name}`
                            });
                        }
                    }
                }

                const schedule_busys = await models.schedule_busy.find({event_id:scene.event_id, user_id:user.id, timeslot_id:timeslot.id});
                if (schedule_busys.length){
                    issues.push({
                        code: 'user-dbl-busy',
                        text: `${user.name} is also busy with ${(_.pluck(schedule_busys, 'name')).join(', ')}`
                    });
                }
            }
        }
    }

    userCounts.players.total = userCounts.players.confirmed + userCounts.players.suggested;
    userCounts.staff.total = userCounts.staff.confirmed + userCounts.staff.suggested;
    if (userCounts.players.total < scene.player_count_min){
        issues.push({
            code: 'not-enough-players',
            text: 'Not enough Players'
        });
    } else if (userCounts.players.total > scene.player_count_max){
        issues.push({
            code: 'too-many-players',
            text: 'Too many Players'
        });
    }
    if (userCounts.players.suggested){
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

    console.log(`1: ${(new Date()).getTime() - time}`); time = (new Date()).getTime();

    await saveSceneIssues(scene.id, issues);

    console.log(`3: ${(new Date()).getTime() - time}`); time = (new Date()).getTime();
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
async function saveIssue(sceneId, code, text){
    if (!_.has(issueList, code)){
        return;
    }
    const current = await models.scene_issue.findOne({scene_id:sceneId, code:code, text:text});
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
        code: code,
        level: issueList[code],
        text: text
    });
}

async function clearIssue(sceneId, code){
    const current: SceneIssueModel[] = await models.scene_issue.find({scene_id:sceneId, code:code});
    return async.each(current, async (issue) => {
        if (issue.resolved) { return; }
        if (issue.ignored) {
            issue.resolved = true;
            return models.scene_issue.update(issue.id, issue);
        } else {
            return models.scene_issue.delete(issue.id);
        }
    });
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
export default validateScene;
