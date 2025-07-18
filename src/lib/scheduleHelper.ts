'use strict';
import _ from 'underscore';
import models from './models';
import async from 'async';
import stringify from 'csv-stringify-as-promised';
import validator from './scheduler/validator';
import {DateTime} from 'luxon';

function formatScene(scene:SceneModel, forPlayer:boolean=false): FormattedSceneModel{
    if (forPlayer && !scene.display_to_pc){
        return {};
    }
    const output: FormattedSceneModel = {
        id:scene.id,
        guid:scene.guid,
        campaign_id: scene.campaign_id,
        event_id: scene.event_id,
        event: scene.event,
        status: scene.status,
        display_to_pc: scene.display_to_pc,
        timeslot_count: scene.timeslot_count,
        locations_count: scene.locations_count,
        player_url: scene.player_url,
        description: scene.description

    };


    if (forPlayer){
        output.name = scene.player_name?scene.player_name:scene.name;
    } else {
        output.name = scene.name;
        output.player_name = scene.player_name;
        output.schedule_notes = scene.schedule_notes;
        output.player_count_min = scene.player_count_min;
        output.player_count_max = scene.player_count_max;
        output.staff_count_min = scene.staff_count_min;
        output.staff_count_max = scene.staff_count_max;
        output.combat_staff_count_min = scene.combat_staff_count_min;
        output.combat_staff_count_max = scene.combat_staff_count_max;
        output.staff_url = scene.staff_url;
        output.setup_slots = scene.setup_slots;
        output.cleanup_slots = scene.cleanup_slots;
        output.tags = _.pluck(scene.tags, 'name');
    }

    if (scene.score){
        output.score = scene.score
    }

    if (!forPlayer && scene.prereqs && typeof scene.prereqs !== 'string'){
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
    if (forPlayer){
        if (output.locations.confirmed){
            output.locations = {
                confirmed: output.locations.confirmed
            }
        } else {
            output.locations = { confirmed: [] };
        }
    }


    output.timeslots = _.groupBy(scene.timeslots, 'scene_schedule_status');
    if (forPlayer){
        if (output.timeslots.confirmed){
            output.timeslots = {
                confirmed: output.timeslots.confirmed
            }
        }
        else {
            output.timeslots = { confirmed: [] };
        }
    }

    if (output.timeslots.confirmed && output.timeslots.confirmed.length){
        output.start = output.timeslots.confirmed[0].name;
        output.duration = 0;
        for (const timeslot of output.timeslots.confirmed){
            output.duration += timeslot.length;
        }
    } else if (output.timeslots.suggested){
        output.start = output.timeslots.suggested[0].name;
        output.duration = 0;
        for (const timeslot of output.timeslots.suggested){
            output.duration += timeslot.length;
        }
    }

    if (!forPlayer){
        const sources = scene.sources.map(source => {
            return {
                id: source.id,
                name: source.name,
                type: source.type.name,
                scene_request_status: source.scene_request_status,
            };

        });

        output.sources = _.groupBy(sources, 'scene_request_status');
        const skills = scene.skills.map(skill => {
            return {
                id: skill.id,
                name: skill.name,
                source: skill.source.name,
                scene_request_status: skill.scene_request_status,
            };

        });

        output.skills = _.groupBy(skills, 'scene_request_status');
    }

    const players = scene.users.filter(user => {
        return user.type === 'player';
    }).map(user => {
        const doc: CampaignUser = {
            id: user.id,
            name: user.name,
            character: null,
            type: user.type,
            scene_schedule_status: user.scene_schedule_status
        }
        if (!forPlayer){
            doc.tags = _.pluck(user.tags, 'name');
            doc.scene_request_status = user.scene_request_status;
            doc.email = user.email;
        }
        if (user.character){
            doc.character = {
                id: user.character.id,
                name: user.character.name
            }
        }
        if (doc.character && forPlayer){
            doc.name = doc.character.name
        }
        return doc;
    });
    output.players = _.groupBy(players, 'scene_schedule_status');
    if (forPlayer){
        if (output.players.confirmed){
            output.players = {
                confirmed: output.players.confirmed
            }
        } else {
            output.players = { confirmed: [] };
        }
    }
    if (!forPlayer){
        const staff = scene.users.filter(user => {
            return user.type !== 'player';
        }).map(user => {
            const doc = {
                id: user.id,
                name: user.name,
                email: user.email,
                type: user.type,
                tags: _.pluck(user.tags, 'name'),
                scene_schedule_status: user.scene_schedule_status,
                scene_request_status: user.scene_request_status,
                npc: null
            }
            if (user.scene_details && user.scene_details.npc && typeof user.scene_details.npc === 'string' && user.scene_details.npc !== ''){
                doc.npc = user.scene_details.npc;
            }
            return doc;
        });
        output.staff = _.groupBy(staff, 'scene_schedule_status');
        output.users = [...players, ...staff];
        output.usersByStatus = _.groupBy(scene.users, 'scene_schedule_status');
    } else {
        output.users = [...players].filter(user => { return user.scene_schedule_status === 'confirmed'});
        output.usersByStatus = output.players;
    }

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

    return scenes.map(scene=> {return formatScene(scene); });
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

async function getUserSchedule(eventId:number, userId:number, forPlayer:boolean=false, showUnconfirmed:boolean=false): Promise<TimeslotModel[]> {
    const event = await models.event.get(eventId);
    if (!event) { throw new Error('Invalid Event'); }

    if (forPlayer){
        showUnconfirmed = false;
    }

    const schedule = await getSchedule(eventId);

    const timeslots = schedule.timeslots;

    const scenes = [];
    for (const scene of schedule.scenes){
        if (showUnconfirmed){
            if (!scene.status.match(/^(confirmed|scheduled)$/)){
                console.log(`continue on ${scene.name}`)
                continue;
            }
        } else if (scene.status !== 'confirmed'){
            continue;
        }

        for (const scene_user of scene.users){
            if (scene_user.id === userId &&
                (scene_user.scene_schedule_status === 'confirmed' ||
                (showUnconfirmed && scene_user.scene_schedule_status === 'suggested'))
            ){
                scenes.push(scene);
                break;
            }
        }
    }

    return async.map(timeslots, async (timeslot: TimeslotModel)=>{
        timeslot.scenes = [];

        for (const scene of scenes){
            if (_.findWhere(scene.timeslots, {id:timeslot.id, scene_schedule_status:'confirmed'}) ||
                (showUnconfirmed && _.findWhere(scene.timeslots, {id:timeslot.id, scene_schedule_status:'suggested'}))
            ){
                const formattedScene = formatScene(scene);
                const userRecord = _.findWhere(formattedScene.users, {id:userId});
                if (userRecord && userRecord.npc){
                    formattedScene.npc = userRecord.npc
                }
                timeslot.scenes.push(formattedScene);
            }
        }

        const schedule_busy = _.findWhere(schedule.schedule_busies, {user_id:userId, timeslot_id:timeslot.id});

        if (schedule_busy && (!forPlayer || schedule_busy.type.display_to_player)){
            timeslot.schedule_busy = schedule_busy
        } else {
            timeslot.schedule_busy = null;
        }
        return timeslot;
    });
}

async function getCsv(eventId:number, csvType:string):Promise<string>{
    const event = await models.event.get(eventId);

    const schedule = await models.schedule.current(eventId);

    let scenes = schedule.scene.filter(scene => {
        return scene.status === 'confirmed';
    });
    scenes = scenes.map(scene=> {return formatScene(scene); });
    const timeslots = schedule.timeslots;
    const locations = schedule.locations;
    const output = [];
    const header = ['Location', 'Attendee'];
    for (const timeslot of timeslots){
        header.push(timeslot.name)
    }
    output.push(header);
    for(const location of locations){
        const row = [location.name];
        const locationScenes = scenes.filter(scene => {
            return !!(scene.locations.confirmed && _.findWhere(scene.locations.confirmed, {id:location.id}));
        });
        for (const timeslot of timeslots){

            const slotScenes = locationScenes.filter(scene => {
                return !!(scene.timeslots.confirmed && _.findWhere(scene.timeslots.confirmed, {id:timeslot.id}));
            });
            const sceneNames = [];
            for (const scene of slotScenes){
                if (csvType === 'staff'){
                    let sceneName = scene.name;
                    if (scene.player_name){
                        sceneName += ` (${scene.player_name})`
                    }
                    sceneNames.push(sceneName);
                } else if (scene.display_to_pc){
                    if (scene.player_name){
                        sceneNames.push(scene.player_name);
                    } else {
                        sceneNames.push(scene.name)
                    }
                }
            }
            row.push(sceneNames.join(', '))
        }
        output.push(row);
    }

    if (csvType === 'staff'){
        const staffHeader = ['Staff List', null];
        for (let idx = 0; idx < timeslots.length; idx++){
            staffHeader.push(null)
        }
        output.push(staffHeader);
        for (const attendance of event.attendees){
            if (!attendance.attending){ continue; }
            if (attendance.user.type === 'player') { continue; }
            const schedule = await getUserSchedule(event.id, attendance.user_id);
            const row = [attendance.user.name, null];
            for (const timeslot of schedule){
                const userScenes = [];
                if (timeslot.schedule_busy){
                    userScenes.push(timeslot.schedule_busy.name)
                }
                for (const scene of timeslot.scenes){
                    let sceneName = scene.name
                    const userRecord = _.findWhere(scene.users, {id:attendance.user_id});
                    if (userRecord && userRecord.npc){
                        sceneName += ` (${userRecord.npc})`;
                    }
                    userScenes.push(sceneName);
                }
                row.push(userScenes.join(', '))
            }
            output.push(row);
        }
    }

    const playerHeader = ['Player List'];
    for (let idx = 0; idx < timeslots.length; idx++){
        playerHeader.push(null)
    }
    output.push(playerHeader);
    for (const attendance of event.attendees){
        if (!attendance.attending){ continue; }
        if (attendance.user.type !== 'player') { continue; }
        const schedule = await getUserSchedule(event.id, attendance.user_id);

        const character = await models.character.findOne({campaign_id:event.campaign_id, user_id:attendance.user_id, active:true});
        const row = [character?character.name:attendance.user.name, attendance.user.name];
        for (const timeslot of schedule){
            const userScenes = [];
            if (timeslot.schedule_busy){
                userScenes.push(timeslot.schedule_busy.name)
            }
            for (const scene of timeslot.scenes){
                if (csvType === 'player'){
                    if (!scene.display_to_pc) { continue; }
                    if (scene.player_name){
                        userScenes.push(scene.player_name);
                    } else {
                        userScenes.push(scene.name)
                    }
                } else {
                    userScenes.push(scene.name);
                }
            }
            row.push(userScenes.join(', '))
        }
        output.push(row);
    }

    return stringify(output, {});
}

async function checkScheduleConfigMatches(campaignId:number, schedule){
    for (const type of ['timeslot', 'location']){
        const current = await models[type].find({campaign_id:campaignId});
        for (const item of current){
            const checkItem = _.findWhere(schedule[`${type}s`], {id:item.id});
            if(!checkItem){
                console.log('new item added')
                continue;
            }
            for (const field of models[type].fields){
                if (checkItem[field] !== item[field]){
                    console.log(`${field} differs`);
                    return false;
                }
            }
        }
        for (const item of schedule[`${type}s`]){
            const checkItem = _.findWhere(current, {id:item.id});
            if(!checkItem){
                console.log('item removed')
                return false;
            }
            for (const field of models[type].fields){
                if (checkItem[field] !== item[field]){
                    console.log(`${field} differs`);
                    return false;
                }
            }
        }
    }
    return true;
}

async function saveSchedule(eventId: number, name:string=null, keep:boolean=false){
    const event = await models.event.get(eventId);
    const current = await models.schedule.current(eventId);
    const doc = {
        event_id: eventId,
        name: name,
        keep: keep,
        timeslots: await models.timeslot.find({campaign_id:event.campaign_id}),
        locations: await models.location.find({campaign_id:event.campaign_id}),
        scenes: await models.scene.find({event_id:eventId}),
        schedule_busies: await models.schedule_busy.find({event_id:eventId}),
        created: new Date()
    };

    if (current && current.read_only){
        return;
    }
    return models.schedule.save(doc);
}

async function getSchedule(eventId:number){
    const event = await models.event.get(eventId);
    const schedule = await models.schedule.current(eventId);
    if (schedule){
        if (schedule.read_only || await checkScheduleConfigMatches(event.campaign_id, schedule)){
            return schedule;
        }

        const scenes = schedule.scenes.filter(scene => {
            return scene.status === 'scheduled' || scene.status === 'confirmed';
        });

        if (scenes.length){
            schedule.read_only = true;
            await models.schedule.update(schedule.id, schedule);
            event.schedule_read_only = true;
            await models.event.update(event.id, event);
        }
        return schedule;
    }
    return {
        name: 'live',
        read_only: false,
        timeslots: await models.timeslot.find({campaign_id:event.campaign_id}),
        locations: await models.location.find({campaign_id:event.campaign_id}),
        scenes: await models.scene.find({event_id:eventId}),
        schedule_busies: await models.schedule_busy.find({event_id:eventId})
    }
}

async function saveScheduleScene(eventId:number, sceneId:number){
    const scene = await models.scene.get(sceneId);
    if (Number(eventId) !== Number(scene.event_id)){
        return;
    }
    const schedule = await models.schedule.current(eventId);
    if (!schedule.read_only){
        return saveSchedule(eventId);
    }
    for (const item of schedule.scenes){
        if (Number(item.id) !== Number(scene.id)) { continue; }
        for (const field in item){
            if (_.has(item, field) && item[field] != scene[field]){
                item[field] = scene[field];
            }
        }
    }
    return models.schedule.update(schedule.id, schedule);
}

async function removeScheduleScene(eventId:number, sceneId:number){
    const scene = await models.scene.get(sceneId);
    if (Number(eventId) !== Number(scene.event_id)){
        return;
    }
    const schedule = await models.schedule.current(eventId);
    if (!schedule.read_only){
        return saveSchedule(eventId);
    }
    schedule.scenes = schedule.scenes.filter(scene => {
        return Number(scene.id !== sceneId);
    });
    return models.schedule.update(schedule.id, schedule);
}

async function restoreSchedule(scheduleId:number){
    const schedule = await models.schedule.get(scheduleId);
    if (!schedule){ throw new Error('Invalid Schedule'); }
    const scheduleFormattedDate = (DateTime.fromJSDate(new Date(schedule.created))).toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS);
    schedule.name = `restore from ${scheduleFormattedDate}`;
    console.log(schedule.name);
    if (schedule.read_only){
        // bump this to the top of the snapshots, but do not update anything live
        return models.schedule.save(schedule)
    }
    const event = await models.event.get(schedule.event_id);
    if (!await checkScheduleConfigMatches(event.campaign_id, schedule)){
        // Config has changed, make read-only and bump
        schedule.read_only = true;
        return models.schedule.save(schedule)
    }
    await async.each(schedule.scenes as SceneModel[], async (scene) => {
        const currentScene = await models.scene.get(scene.id);
        if (!currentScene) { return; }
        currentScene.status = scene.status;
        if (scene.id === 12){ console.log(scene.timeslots); console.log(currentScene.timeslots)}
        for (const type of ['timeslots', 'locations', 'users']){
            currentScene[type] = scene[type];
        }
        if (scene.id === 12){ console.log(currentScene.timeslots)}
        return models.scene.update(currentScene.id, currentScene);
    });

    await async.each(schedule.schedule_busies as ScheduleBusyModel[], async(schedule_busy) => {
        const current = await models.schedule_busy.get(schedule_busy.id);
        if (!current){
            return models.schedule_busy.create(schedule_busy);
        }
        return models.schedule_busy.update(current.id, schedule_busy);
    });

    return saveSchedule(event.id, schedule.name);
}

export default {
    validateScene: validator,
    formatScene,
    formatUser,
    getEventUsers,
    getEventScenes,
    getScenesAtTimeslot,
    getUsersAtTimeslot,
    getUserSchedule,
    getCsv,
    saveSchedule,
    saveScheduleScene,
    getSchedule,
    removeScheduleScene,
    restoreSchedule,
};
