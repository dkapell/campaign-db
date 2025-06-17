import _ from 'underscore';
import async from 'async';
const corpora = require('corpora-project');

import userModel from '../../models/user';
import eventModel from '../../models/event';
import attendanceModel from '../../models/attendance';
import characterModel from '../../models/character';
import sceneModel from '../../models/scene';
import tagModel from '../../models/tag';
import locationModel from '../../models/location';
import timeslotModel from '../../models/timeslot';
import sourceModel from '../../models/skill_source';
import characterModel from '../../models/character';
import skillModel from '../../models/skill';

const models = {
    tag: tagModel,
    location: locationModel,
    timeslot: timeslotModel,
    user: userModel,
    source: sourceModel,
    event: eventModel,
    character: characterModel,
    skill: skillModel,
    event: eventModel,
    attendance: attendanceModel,
    character: characterModel,
    scene: sceneModel
};

const eventId = 3;
const sceneCount = 13;

const data = {
    request: {
        type: {
            50: 'all',
            75: 'open',
            100: 'picky'
        },
        all: {
            100: 'requested'
        },
        open: {
            85: 'requested',
            95: 'required',
            100: 'rejected'
        },
        picky: {
            30: 'none',
            50: 'requested',
            90: 'required',
            100: 'rejected'
        }
    },
    timeslot: {
        count: {
            85: 1,
            95: 2,
            99: 3,
            100: 4
        },
        type: {
            60: 'regular',
            80: 'any',
            95: 'random',
            100: 'special'
        }
    },
    location: {
        count:{
            85: 1,
            95: 2,
            99: 3,
            100: 4
        },
        type: {
            50: 'combat',
            80: 'non-combat',
            100: 'random'
        }
    },
    player: {
        count: {
            30: 4,
            80: 6,
            90: 8,
            100: 2
        }
    },
    staff: {
        count: {
            30: 2,
            80: 4,
            90: 6,
            100: 1
        }
    },
    source: {
        45: 0,
        70: 1,
        85: 2,
        100: 3
    },
    skill: {
        45: 0,
        70: 1,
        85: 2,
        100: 3
    }
};

const cache = {
    skills: [],
    sources: [],
    timeslots:[],
    locations: [],
    players: [],
    staff: []
};

(async function main() {
    const event = await models.event.get(eventId);
    await loadCache(event);

    for (let i = 0; i < sceneCount; i++){
        await createRandomScene(event);

    }
    //await createAllPCScene(event);

    process.exit(0);

})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});

async function loadCache(event){
    cache.timeslots = await models.timeslot.find({campaign_id:event.campaign_id});
    cache.locations = await models.location.find({campaign_id:event.campaign_id});
    cache.players = event.attendees.filter(attendance => {return attendance.attending && attendance.user.type === 'player'});
    cache.staff = event.attendees.filter(attendance => {return attendance.attending && attendance.user.type !== 'player'});
    cache.sources = (await models.source.find({campaign_id:event.campaign_id})).filter(source => {
        return !source.required;
    });
    cache.skills = (await models.skill.find({campaign_id:event.campaign_id})).filter(skill => {
        return skill.source && skill.status.purchasable && skill.name && !skill.required;
    });
}

async function createRandomScene(event){
    const scene: SceneModel = {
        campaign_id: event.campaign_id,
        name: getSceneName(),
        status: 'ready',
        timeslot_count: getTimeslotCount(),
        locations_count: getLocationCount(),
        player_count_min: getPlayerCount(),
        staff_count_min: getStaffCount(),
        description: 'Created by script',
        timeslots: await getTimeslots(event.campaign_id),
        locations: await getLocations(event.campaign_id),
        sources: await getSources(event.campaign_id),
        skills: await getSkills(event.campaign_id)
    }
    scene.player_count_max = getPlayerCount(scene.player_count_min);
    scene.staff_count_max = getStaffCount(scene.staff_count_min);
    const players = getAttendees(cache.players, scene.player_count_max);
    const staff = getAttendees(cache.staff, scene.staff_count_max);
    scene.users = [...players,...staff];
    return models.scene.create(scene);
}
async function createAllPCScene(event){
    const scene: SceneModel = {
        campaign_id: event.campaign_id,
        name: 'Town Fight',
        status: 'ready',
        timeslot_count: 1,
        locations_count: 1,
        description: 'Created by script',
        player_count_min: cache.players.length - 5,
        staff_count_min: cache.staff.length - 5,
        timeslots: await getTimeslots(event.campaign_id, -1),
        locations: await getLocations(event.campaign_id, 'combat'),
        users:[]
    }
    scene.player_count_max = getPlayerCount(scene.player_count_min);
    scene.staff_count_max = getStaffCount(scene.staff_count_min);
    return models.scene.create(scene);
}

function getChance(chance){
    return Math.random() < chance;
}

function getSceneName(){
    return `${capitalize(getRandomElement('adjs'))} ${capitalize(getRandomElement('nouns'))}`
}

function getRandomElement(type){
    const words = corpora.getFile('words', type)[type];
    return words[Math.floor(Math.random()*words.length)];
}

function getTimeslotCount(){
    return weightedPick(data.timeslot.count);

}
function getLocationCount(){
    return weightedPick(data.location.count);
}
function getPlayerCount(min){
    if (min) { return min + Math.floor(Math.random() * 4) }
    return weightedPick(data.player.count)
}
function getStaffCount(min){
    if (min) { return min + Math.floor(Math.random() * 4) }
    return weightedPick(data.staff.count);
}

async function getTimeslots(campaignId, last=null){
    const output = [];

    if (last){
        const timeslot = cache.timeslots[cache.timeslots.length-1];
        timeslot.scene_request_status = 'required'
        output.push(timeslot);
        return output;
    }
    const type = weightedPick(data.timeslot.type);

    for (const timeslot of cache.timeslots){
        switch (type){
            case 'regular':
                if (timeslot.type === 'regular'){
                    timeslot.scene_request_status = weightedPick(data.request[weightedPick(data.request.type)])
                    output.push(timeslot);
                }
                break;
            case 'any':
                if (timeslot.type !== 'special'){
                    timeslot.scene_request_status = weightedPick(data.request[weightedPick(data.request.type)])
                    output.push(timeslot);
                }
                break;
            case 'special':
                if (timeslot.type === 'special'){
                    timeslot.scene_request_status = weightedPick(data.request[weightedPick(data.request.type)])
                    output.push(timeslot);
                }
                break;
            case 'random':
                if (timeslot.type === 'regular' && getChance(0.5)){
                    timeslot.scene_request_status = weightedPick(data.request[weightedPick(data.request.type)])
                    output.push(timeslot);
                }

        }
    }
    return output;
}

async function getLocations(campaignId, type:string=null){

    let required = false;
    if (type){
        required = true;
    } else{
        type = weightedPick(data.location.type);
    }
    const output = [];
    for (const location of cache.locations){
        switch (type){
            case 'combat':
                if (location.combat){
                    if (required){
                        location.scene_request_status = 'required';
                    } else {
                        location.scene_request_status = weightedPick(data.request[weightedPick(data.request.type)])
                    }
                    output.push(location);
                }
                break;
            case 'non-combat':
                if (!location.combat){
                    if (required){
                        location.scene_request_status = 'required';
                    } else {
                        location.scene_request_status = weightedPick(data.request[weightedPick(data.request.type)])
                    }
                    output.push(location);
                }
                break;
            case 'random':
                if (getChance(0.5)){
                    if (required){
                        location.scene_request_status = 'required';
                    } else {
                        location.scene_request_status = weightedPick(data.request[weightedPick(data.request.type)])
                    }
                    output.push(location);
                }
        }
    }
    return output;
}

function getAttendees(attendees, attendeeCount){
    const userIds = [];
    const numWanted = Math.floor(Math.random() * attendeeCount);
    for (let idx = 0; idx < numWanted; idx++){
        const userId = pick(_.pluck(attendees, 'user_id'), userIds);
        userIds.push(userId)
    }
    const output = []
    for (const userId of userIds){
        const attendance = _.findWhere(attendees, {user_id:userId});
        output.push({
            id: attendance.user_id,
            name: attendance.user.name,
            scene_request_status: weightedPick(data.request[weightedPick(data.request.type)])
        });
    }
    return output;
}

async function getSources(campaignId){

    const sourceIds = [];
    const sourceCount = weightedPick(data.source);
    for (let i = 0; i < sourceCount; i++){
        const sourceId = pick(_.pluck(cache.sources, 'id'), sourceIds);
        sourceIds.push(sourceId);
    }
    return sourceIds.map(sourceId => {
        const source = _.findWhere(cache.sources, {id:sourceId})
        const doc = {
            id: source.id,
            name: source.name,
            scene_request_status: weightedPick(data.request.open)
        }
        return doc;
    });
}
async function getSkills(campaignId){


    const skillIds = [];
    const skillCount = weightedPick(data.skill);
    for (let i = 0; i < skillCount; i++){
        const skillId = pick(_.pluck(cache.skills, 'id'), skillIds);
        skillIds.push(skillId);
    }
    return skillIds.map(skillId => {
        const skill = _.findWhere(cache.skills, {id:skillId})
        const doc = {
            id: skill.id,
            name: skill.name,
            scene_request_status: weightedPick(data.request.open)
        }
        return doc;
    });
}

function pick(list, value){
    if (typeof(value) === 'undefined'){
        value = "";
    }
    let choice = "";
    if (Array.isArray(value)){
        do {
            choice = list[Math.floor(Math.random()*list.length)];
        }
        while ( Array.isArray(value) && _.indexOf(value, choice) !== -1);
    } else {
        do {
            choice = list[Math.floor(Math.random()*list.length)];
        }
        while (choice === value);
    }
    return choice;
}

function weightedPick(list){
    const val = Math.floor(Math.random() * 100)+1;
    let keys = _.keys(list);
    keys = keys.map(function(e) { return Number(e)});
    for (let i = 0; i < keys.length; i++){
        if (Number(keys[i]) >= val){
            return list[keys[i]];
        }
    }
    return null;
}

function capitalize(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
};
