'use strict';
import _ from 'underscore';
import models from './models';
//import cache from './cache';
import async from 'async';
import stringify from 'csv-stringify-as-promised';
import validator from './scheduler/validator';
import {DateTime} from 'luxon';
import removeMd from 'remove-markdown';
import scheduleReportRenderer from './renderer/schedule_report';
import database from '../lib/database';

const statusOrder = ['required', 'requested', 'rejected', 'none'];

const scheduleSaveQueues = {};

function sceneItemSorter(a, b){
    if (a.scene_request_status !== b.scene_request_status){
        return _.indexOf(statusOrder, a.scene_request_status) - _.indexOf(statusOrder, b.scene_request_status)
    }
    return a.name.localeCompare(b.name);
}

function formatScene(scene:SceneModel, forPlayer:boolean=false): FormattedSceneModel{
    if (forPlayer && !scene.display_to_pc){
        return null;
    }
    const output: FormattedSceneModel = {
        id:scene.id,
        guid:scene.guid,
        campaign_id: scene.campaign_id,
        event_id: scene.event_id,
        event: scene.event,
        status: scene.status,
        player_count_max: scene.player_count_max,
        display_to_pc: scene.display_to_pc,
        timeslot_count: scene.timeslot_count,
        locations_count: scene.locations_count,
        player_url: scene.player_url,
        description: scene.description,
        printout_note: scene.printout_note,
        assign_players: scene.assign_players,
        non_exclusive: scene.non_exclusive,
        for_anyone: scene.for_anyone
    };


    if (forPlayer){
        output.name = scene.player_name?scene.player_name:scene.name;
        output.tags = _.pluck(scene.tags.filter(tag => { return tag.display_to_pc}), 'name');
    } else {
        output.name = scene.name;
        output.player_name = scene.player_name;
        output.schedule_notes = scene.schedule_notes;
        output.player_count_min = scene.player_count_min;
        output.staff_count_min = scene.staff_count_min;
        output.staff_count_max = scene.staff_count_max;
        output.combat_staff_count_min = scene.combat_staff_count_min;
        output.combat_staff_count_max = scene.combat_staff_count_max;
        output.staff_url = scene.staff_url;
        output.setup_slots = scene.setup_slots;
        output.cleanup_slots = scene.cleanup_slots;
        output.tags = _.pluck(scene.tags, 'name');
        output.writer_id = scene.writer_id;
        output.writer = scene.writer;
        output.additional_writers = scene.additional_writers;
        output.runner_id = scene.runner_id;
        output.runner = scene.runner;
        output.created = scene.created;
        output.updated = scene.updated;
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
    if (!forPlayer && scene.coreqs && typeof scene.coreqs !== 'string'){
        output.coreqs = scene.coreqs.map((coreq:SceneModel)=> {
            if (typeof coreq === 'object'){
                return {
                    id: coreq.id,
                    name: coreq.name,
                    status: coreq.status,
                    event: typeof coreq.event === 'object'?coreq.event.name:null,
                    event_id: coreq.event_id
                }
            } else {
                return coreq;
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

function formatSceneForSurvey(scene:FormattedSceneModel){
    const doc = {
        id: scene.id,
        name: scene.name,
        player_name: scene.player_name,
        timeslots: scene.timeslots.confirmed,
        locations: _.pluck(scene.locations.confirmed, 'name'),
        staff: [],
        players: scene.players.confirmed?_.pluck(scene.players.confirmed, 'name'):[],
        writer: scene.writer_id?scene.writer.name:null,
        additional_writers: scene.additional_writers,
        feedback_id:scene.feedback_id,
        gm_feedback: scene.gm_feedback,
        npc_feedback: scene.npc_feedback,
        skipped: scene.skipped
    };
    if (scene.staff.confirmed){
        for (const staff of scene.staff.confirmed){
            let name = staff.name;
            if (staff.npc){
                name += ` (${staff.npc})`;
            }
            doc.staff.push(name);
        }
    }
    doc.staff.sort();
    return doc;
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
        busy: user.busy,
        non_exclusive: user.non_exclusive
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

async function getScenesAtTimeslot(eventId:number, timeslotId:number, scenes:FormattedSceneModel[] = null): Promise<FormattedSceneModel[]>{
    if (!scenes){
        scenes = await getEventScenes(eventId);
    }
    return scenes.filter(scene => {
        if (_.findWhere(scene.timeslots.confirmed, {id:timeslotId})){
            return true;
        } else if (_.findWhere(scene.timeslots.suggested, {id:timeslotId})){
            return true;
        }
        return false;
    });
}

async function getUsersAtTimeslot(eventId:number, timeslotId:number, data:GetUsersAtTimeslotCache = {}): Promise<CampaignUser[]>{
    if (!_.has(data, 'users')){
        data.users = await getEventUsers(eventId);
    }
    if (!_.has(data, 'scenes')){
        data.scenes = await getScenesAtTimeslot(eventId, timeslotId);
    }
    if (!_.has(data, 'schedule_busys')){
        data.schedule_busys = await models.schedule_busy.find({event_id:eventId});
    }

    const users = JSON.parse(JSON.stringify(data.users));

    return users.map(user => {
        let statuses = [];
        user.non_exclusive = false;

        for (const scene of data.scenes){
            if (scene.usersByStatus && _.findWhere(scene.usersByStatus.confirmed, {id:user.id})){
                const record = _.findWhere(scene.usersByStatus.confirmed, {id:user.id});
                statuses.push({
                    type:'scene',
                    sceneId:scene.id,
                    status:record.scene_schedule_status,
                    busy: !(user.type === 'player' && scene.non_exclusive)
                });
                if (user.type === 'player' && scene.non_exclusive){ user.non_exclusive = true; }
            } else if (scene.usersByStatus && _.findWhere(scene.usersByStatus.suggested, {id:user.id})){
                const record = _.findWhere(scene.usersByStatus.suggested, {id:user.id});
                statuses.push({
                    type: 'scene',
                    sceneId:scene.id,
                    status:record.scene_schedule_status,
                    busy: !(user.type === 'player' && scene.non_exclusive)
                });
                if (user.type === 'player' && scene.non_exclusive){ user.non_exclusive = true; }
            }
        }
        const schedule_busys = _.where(data.schedule_busys, {user_id:user.id, timeslot_id:timeslotId});

        for (const schedule_busy of schedule_busys){
            statuses.push({type: 'busy', name:schedule_busy.type.name, status:'scheduled', busy:true})
        }

        statuses = _.where(statuses, {busy:true});

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

async function getUserSchedule(eventId:number, userId:number, forPlayer:boolean=false, showUnconfirmed:boolean=false, schedule=null): Promise<TimeslotModel[]> {
    const event = await models.event.get(eventId, {postSelect:async(data)=>{return data;}});
    if (!event) { throw new Error('Invalid Event'); }

    if (forPlayer){
        showUnconfirmed = false;
    }

    if (!schedule){
        schedule = await getSchedule(eventId);
    }

    const timeslots = schedule.timeslots;

    const scenes = [];
    for (const scene of schedule.scenes){
        if (!scene) { continue; }
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

    return timeslots.map((timeslot: TimeslotModel)=>{
        timeslot.scenes = [];

        for (const scene of scenes){
            if (_.findWhere(scene.timeslots, {id:timeslot.id, scene_schedule_status:'confirmed'}) ||
                (showUnconfirmed && _.findWhere(scene.timeslots, {id:timeslot.id, scene_schedule_status:'suggested'}))
            ){
                const formattedScene = formatScene(scene, forPlayer);
                if (!formattedScene){ continue; }
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

async function getAnyoneSchedule(eventId:number, forPlayer:boolean=false, showUnconfirmed:boolean=false): Promise<TimeslotModel[]> {
    const event = await models.event.get(eventId);
    if (!event) { throw new Error('Invalid Event'); }

    if (forPlayer){
        showUnconfirmed = false;
    }

    const schedule = await getSchedule(eventId);

    const timeslots = schedule.timeslots;

    const scenes = schedule.scenes.filter(scene => {
        if (showUnconfirmed && !scene.status.match(/^(confirmed|scheduled)$/)){
            return false;
        } else if (scene.status !== 'confirmed'){
            return false;
        }
        return scene.for_anyone;
    });

    return async.map(timeslots, async (timeslot: TimeslotModel)=>{
        timeslot.scenes = [];

        for (const scene of scenes){
            if (_.findWhere(scene.timeslots, {id:timeslot.id, scene_schedule_status:'confirmed'}) ||
                (showUnconfirmed && _.findWhere(scene.timeslots, {id:timeslot.id, scene_schedule_status:'suggested'}))
            ){
                const formattedScene = formatScene(scene, forPlayer);
                if (formattedScene){
                    timeslot.scenes.push(formattedScene);
                }
            }
        }
        timeslot.scenes = timeslot.scenes.filter(scene=>{return scene});

        return timeslot;
    });
}

async function getCsv(eventId:number, csvType:string):Promise<string>{
    const event = await models.event.get(eventId);
    const campaign = await models.campaign.get(event.campaign_id);

    const schedule = await models.schedule.current(eventId);

    let scenes = schedule.scenes.filter(scene => {
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
        const row = [location.name, null];
        const locationScenes = scenes.filter(scene => {
            return !!(scene.locations.confirmed && _.findWhere(scene.locations.confirmed, {id:location.id}));
        });
        for (const timeslot of timeslots){

            const slotScenes = locationScenes.filter(scene => {
                return !!(scene.timeslots.confirmed && _.findWhere(scene.timeslots.confirmed, {id:timeslot.id}));
            });
            const sceneNames = [];
            for (const scene of slotScenes){
                let sceneName = scene.name;
                if (csvType === 'staff'){
                    if (scene.player_name){
                        sceneName += ` (${scene.player_name})`
                    }
                } else if (scene.display_to_pc){
                    if (scene.player_name){
                        sceneName = scene.player_name
                    }
                }
                let playerCount = 0;
                playerCount += scene.players.confirmed?scene.players.confirmed.length:0;
                playerCount += scene.players.suggested?scene.players.suggested.length:0;

                if (scene.player_count_max-playerCount>0 || scene.for_anyone){
                    sceneName += ' +';
                }
                sceneNames.push(sceneName);
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

    const anyoneRow = ['Anyone', null];
    let anyoneScenes = false;
    const anyoneSchedule = await getAnyoneSchedule(event.id, csvType==='player');
    for (const timeslot of anyoneSchedule){
        const userScenes = [];

        for (const scene of timeslot.scenes){
            anyoneScenes = true;
            userScenes.push(scene.name);
        }
        anyoneRow.push(userScenes.join(', '))
    }
    if (anyoneScenes){
        output.push(anyoneRow);
    }

    for (const attendance of event.attendees){
        if (!attendance.attending){ continue; }
        if (attendance.user.type !== 'player') { continue; }
        const schedule = await getUserSchedule(event.id, attendance.user_id, csvType==='player');

        const character = await models.character.findOne({campaign_id:event.campaign_id, user_id:attendance.user_id, active:true});
        const row = [character?character.name:attendance.user.name, attendance.user.name];
        for (const timeslot of schedule){
            const userScenes = [];
            if (timeslot.schedule_busy && timeslot.schedule_busy.type.display_to_player){
                userScenes.push(timeslot.schedule_busy.name)
            }
            for (const scene of timeslot.scenes){
                let sceneName = scene.name
                if (csvType === 'player'){
                    if (!scene.display_to_pc) { continue; }

                    if (scene.player_name){
                        sceneName = scene.player_name
                    }
                }
                if (scene.non_exclusive){
                    sceneName += ` (${campaign.renames.non_exclusive_ind.singular})`
                }
                userScenes.push(sceneName);

            }
            row.push(userScenes.join(', '))
        }
        output.push(row);
    }

    return stringify(output, {});
}

async function getSceneStatusCsv(campaignId:number){
    let scenes = await models.scene.find({campaign_id:campaignId});
    const events = await models.event.find({campaign_id:campaignId});
    const futureEvents = events.filter(event => { return event.end_time > new Date(); });
    scenes = scenes.filter(scene => {
        if (!scene.event_id){ return true; }
        if (_.findWhere(futureEvents, {id:scene.event_id} )){
            return true;
        }
        return false;
    });

    const output = [];
    const header = [
        'Name',
        'Player-Facing Name',
        'Event',
        'Status',
        'Writer',
        'Runner',
        'Tags',
        'Timeslot(s)',
        'Location(s)',
        'Players',
        'Staff',
        'Required Players',
        'Required Staff',
        'Schedule Note',
        'Staff Writeup'
    ]
    output.push(header);
    for (const scene of scenes){
        const row = [];
        row.push(scene.name);
        if (scene.player_name){
            row.push(scene.player_name);
        } else {
            row.push(null);
        }
        if (scene.event_id){
            row.push(scene.event.name);
        } else {
            row.push(null);
        }
        row.push(scene.status);

        if (scene.writer_id){
            row.push(scene.writer.name);
        } else {
            row.push(null)
        }

        if (scene.runner_id){
            row.push(scene.runner.name);
        } else {
            row.push(null)
        }
        row.push(_.pluck(scene.tags, 'name').join(', '));

        const timeslots = [];
        for (const timeslot of scene.timeslots){
            if (timeslot.scene_schedule_status.match(/^(confirmed|suggested)$/)){
                timeslots.push(timeslot.name);
            }
        }
        row.push(timeslots.join(', '));

        const locations = [];
        for (const location of scene.locations){
            if (location.scene_schedule_status.match(/^(confirmed|suggested)$/)){
                locations.push(location.name);
            }
        }
        row.push(locations.join(', '));

        const players = [];
        const staff = [];

        for (const user of scene.users){
            if (user.scene_schedule_status.match(/^(confirmed|suggested)$/)){
                if (user.type === 'player'){
                    players.push(user.name);
                } else {
                    staff.push(user.name);
                }
            }
        }
        row.push(players.join(', '));
        row.push(staff.join(', '));

        const requiredPlayers = [];
        const requiredStaff = [];
        for (const user of scene.users) {
            if (user.scene_request_status === 'required') {
                if (user.type === 'player') {
                    requiredPlayers.push(user.name);
                }
                else {
                    requiredStaff.push(user.name);
                }
            }
        }
        row.push(requiredPlayers.join(', '));
        row.push(requiredStaff.join(', '));

        if (scene.printout_note){
            row.push(removeMd(scene.printout_note))
        } else {
            row.push(null);
        }

        if (scene.staff_url){
            row.push(scene.staff_url);
        } else {
            row.push(null);
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

async function saveSchedule(eventId: number, name:string=null, keep:boolean=false, force:boolean=false){
    const event = await models.event.get(eventId, {postSelect: async(data)=>{return data}});
    const current = await models.schedule.current(eventId);

    if (current && current.read_only && !force){
        return;
    }
    if (!_.has(scheduleSaveQueues, event.id)){
        scheduleSaveQueues[event.id] = 0;
    }

    scheduleSaveQueues[event.id]++;
    let client = null;
    try{
        client = await database.connect();

        // Get Advisory Lock
        await client.query('select pg_advisory_lock($1, $2)', [event.campaign_id, Number(event.id)]);

        if (!scheduleSaveQueues[event.id]) {
            return;
        }

        // Clear queue
        scheduleSaveQueues[event.id] = 0;
        console.log(`Saving Schedule for ${event.name}`)
        interface scheduleData{
            timeslots: TimeslotModel[]
            locations: LocationModel[]
            scenes: SceneModel[]
            schedule_busies: ScheduleBusyModel[]
        }
        const data: scheduleData = await async.parallel({
            timeslots: async () => { return models.timeslot.find({campaign_id:event.campaign_id})},
            locations: async () => { return models.location.find({campaign_id:event.campaign_id})},
            scenes: async () => { return models.scene.find({event_id:event.id})},
            schedule_busies: async () => { return models.schedule_busy.find({event_id:event.id})},
        });

        const doc = {
            event_id: eventId,
            name: name,
            keep: keep,
            timeslots: data.timeslots,
            locations: data.locations,
            scenes: data.scenes,
            schedule_busies: data.schedule_busies,
            created: new Date(),
            metadata: {
                scenes:{
                    scheduled:0,
                    confirmed:0
                },
                timeslots: 0,
                locations:0,
                schedule_busies: 0
            }
        };

        doc.metadata = {
            scenes: {
                scheduled: (_.where(doc.scenes, {status: 'scheduled'})).length,
                confirmed: (_.where(doc.scenes, {status: 'confirmed'})).length
            },
            timeslots: doc.timeslots.length,
            locations: doc.locations.length,
            schedule_busies: doc.schedule_busies.length
        };
        await models.schedule.save(doc, client);

    } catch(err){
        console.trace(err);
        throw err;
    } finally {
        // Release lock
        await client.query('select pg_advisory_unlock($1, $2)', [event.campaign_id, Number(event.id)]);
        await client.release(true);
    }

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
    if (!schedule || !schedule.read_only){
        return saveSchedule(eventId);
    }

    for (const item of schedule.scenes){
        if (Number(item.id) !== Number(scene.id)) { continue; }
        for (const field in item){
            if (_.has(item, field) && item[field] != scene[field]){
                item[field] = scene[field];
            }

        }
        for (const field in scene){
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
        for (const type of ['timeslots', 'locations', 'users']){
            currentScene[type] = scene[type];
        }
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

async function reportPdf(eventId, reportName, reportConfig){
    return scheduleReportRenderer(eventId, reportName, reportConfig);
}

function scheduleVisibleMiddleware(req, res, next){
    req.isScheduleVisible = async function isScheduleVisible(eventId:number):Promise<boolean>{
        const event = await models.event.get(eventId);
        if (!req.campaign.display_schedule){
            return false;
        }
        switch (event.schedule_status){
            case 'private':
                return req.checkPermission('admin, scheduler');

            case 'gm only':
                return req.checkPermission('gm');

            case 'staff only':
                return req.checkPermission('event');

            case 'player visible':
                return req.checkPermission('player')
        }
    }
    next();
}

function formatScheduleForSurvey(schedule){
    return schedule.map(timeslot => {
        return {
            name: timeslot.name,
            display_name: timeslot.name,
            scenes: timeslot.scenes.map(formatSceneForSurvey)
        }
    });
}

export default {
    validateScene: validator,
    formatScene,
    formatSceneForSurvey,
    formatScheduleForSurvey,
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
    getSceneStatusCsv,
    reportPdf,
    sceneItemSorter,
    middleware: scheduleVisibleMiddleware
};
