'use strict'

import async from 'async'
import _ from 'underscore'
import config from 'config'
import models from '../models';
import ScheduleScene from './ScheduleScene';
import ScheduleQueue from './ScheduleQueue';
import ScheduleCache from './ScheduleCache';


interface UsersAvailable{
    all: number[]
    available: number[]
    allocated: number[]
    min: number
    max: number
    sceneCount: number
}

interface FindSlotResult{
    slotted: boolean
    conflicts?: number[]
}

class Schedule {
    scenes: ScheduleScene[];
    event_id: number;
    protected cache: ScheduleCache;
    issues: string[] = [];

    constructor(event_id: number, scenes: SceneModel[], cache:ScheduleCache = null){
        this.event_id = event_id;
        if (cache){
            this.cache = cache;
        } else {
            this.cache = new ScheduleCache(null, event_id);
        }

        this.scenes = scenes.map(scene => {
            return new ScheduleScene(scene, this.cache);
        });
    }

    get happiness():number{
        let happiness = 0;
        for (const scene of this.scenes){
            happiness+= scene.happiness;
        }
        return happiness;
    }

    async write(){
        return async.each(this.scenes, async (scene) => {
            return scene.write();
        });
    }

    async getScenes(){
        const timeslotIds = _.pluck(await this.cache.timeslots(), 'id');
        return this.scenes.map( scene => {
            return {
                id: scene.id,
                name: scene.name,
                timeslots: _.sortBy(scene.currentTimeslots, (id) => {
                    return _.indexOf(timeslotIds, id);
                }),
                locations: scene.currentLocations,
                status: scene.status
            }
        });
    }

    async getSlotScenes(timeslotId, locationId): Promise<ScheduleScene[]>{
        const scenes = [];
        for (const scene of this.scenes){
            const claimedTimeslots = await scene.claimedTimeslots();
            if (_.indexOf(claimedTimeslots, timeslotId) !== -1 &&
                _.indexOf(scene.currentLocations, locationId) !== -1){
                scenes.push(scene)
            }
        }
        return scenes;
    }

    getTimeslotScenes(timeslotId): ScheduleScene[]{
        const scenes = [];
        for (const scene of this.scenes){
            if (_.indexOf(scene.currentTimeslots, timeslotId) !== -1){
                scenes.push(scene)
            }
        }
        return scenes;
    }

    addScene(scene:ScheduleScene){
        const current = _.findWhere(this.scenes, {id: scene.id});
        if (current) {
            current.currentLocations = scene.currentLocations;
            current.currentTimeslots = scene.currentTimeslots;
            current.currentStaff = scene.currentStaff;
            current.currentPlayers = scene.currentPlayers;
            current.score = scene.score;
            current.happiness = scene.happiness;
            current.status = scene.status;
            current.schedule_status = scene.schedule_status;
        } else {
            this.scenes.push(scene);
        }
    }

    async run(scenes:ScheduleScene[], options:SchedulerOptions): Promise<SchedulerResult>{
        const queue = new ScheduleQueue(scenes);
        let unscheduled = 0;
        let scenesProcessed = 0;
        const start =  (new Date()).getTime()
        //let last = start;
        let maxScenesPerRun = config.get('scheduler.maxScenesPerRun') as number;
        if (options.maxScenesPerRun){
            maxScenesPerRun = options.maxScenesPerRun
        }
        while (queue.length && scenesProcessed < maxScenesPerRun){
            scenesProcessed++;
            const scene = queue.next();
            switch (scene.schedule_status){
                case 'new': { // -> slotted
                    const slotResult = await this.findSlot(scene);
                    if (slotResult.slotted){
                        scene.happiness += Number(config.get('scheduler.happiness.scheduled'));
                        scene.schedule_status = 'slotted';
                        queue.enqueue(scene.id);
                    } else if (slotResult.conflicts && slotResult.conflicts.length){
                        for (const id of slotResult.conflicts){
                            queue.enqueue(id, true);
                        }
                        queue.enqueue(scene.id, true);
                    } else {
                        unscheduled++;
                    }
                    //console.log(`ss ${((new Date()).getTime() - last)}ms ${scene.name}`); last = (new Date()).getTime();
                    break;
                }
                case 'slotted': // -> users requested min
                    // fill to min with requested users
                    scene.happiness += await this.fillUsers(scene, 'requested', false, options);
                    scene.schedule_status = 'users requested min';
                    queue.enqueue(scene.id);
                    //console.log(`r- ${((new Date()).getTime() - last)}ms ${scene.name}`); last = (new Date()).getTime();

                    break;
                case 'users requested min': // -> users requested min
                    // Fill to max with requested users
                    scene.happiness += await this.fillUsers(scene, 'requested', true, options);
                    scene.schedule_status = 'users requested max';
                    queue.enqueue(scene.id);
                    //console.log(`r+ ${((new Date()).getTime() - last)}ms ${scene.name}`); last = (new Date()).getTime();

                    break;
                case 'users requested max': // -> users fill skills
                    // Fill to max with users that fill requested sources and skills
                    scene.happiness += await this.fillByCharacter(scene, options);
                    scene.schedule_status = 'users fill skills'
                    if (scene.currentStaff.length < scene.staff_count.max || scene.currentPlayers.length < scene.player_count.max){
                        queue.enqueue(scene.id);
                    } else {
                        scene.schedule_status = 'done';
                    }
                    //console.log(`c+ ${((new Date()).getTime() - last)}ms ${scene.name}`); last = (new Date()).getTime();

                    break;
                case 'users fill skills': // -> users fill min
                    // Fill to min with any user
                    scene.happiness += await this.fillUsers(scene, 'any', false, options);
                    scene.schedule_status = 'users fill min';

                    if (scene.currentStaff.length < scene.staff_count.max || scene.currentPlayers.length < scene.player_count.max){
                        queue.enqueue(scene.id);
                    } else {
                        scene.schedule_status = 'done';
                    }
                    //console.log(`a- ${((new Date()).getTime() - last)}ms ${scene.name}`); last = (new Date()).getTime();

                    break;

                case 'users fill min': // -> done
                    // Fill to max with any available user
                    scene.happiness += await this.fillUsers(scene, 'any', true, options);
                    scene.schedule_status = 'done'
                    //console.log(`a+ ${((new Date()).getTime() - last)}ms ${scene.name}`); last = (new Date()).getTime();
                    break;
            }
            this.addScene(scene);
        }
        console.log(`took ${((new Date()).getTime() - start)}ms: ${this.happiness}`);
        return {
            schedule: this,
            unscheduled: unscheduled,
            happiness: this.happiness,
            issues: this.issues,
            scenesProcessed: scenesProcessed
        };
    }

    protected async findSlot(scene:ScheduleScene):Promise<FindSlotResult>{
        const timeslots = await this.cache.timeslots();
        const possibleTimeslots = await scene.possibleTimeslots(timeslots);
        const foundTimeslots = [];
        const conflicts = [];


        if (await this.checkRequiredUsers(scene)){
            timeslotLoop: for (const timeslotId of possibleTimeslots){
                const timeslotIdx = _.indexOf(_.pluck(timeslots, 'id'), timeslotId);
                for (const prereq of scene.prereqs){
                    let prereqScene:ScheduleScene = null
                    if (typeof prereq === 'number'){
                        prereqScene = _.findWhere(this.scenes, {id:prereq});
                    } else if (typeof prereq === 'object'){
                        prereqScene = _.findWhere(this.scenes, {id:prereq.id});
                    }
                    if (!prereqScene) { continue; }
                    for (const prereqTimeslotId of prereqScene.currentTimeslots){
                        const prereqTimeslotIdx = _.indexOf(_.pluck(timeslots, 'id'), prereqTimeslotId);
                        if (timeslotIdx <= prereqTimeslotIdx){
                            if (_.indexOf(conflicts, prereqScene.id) === -1){
                                conflicts.push(prereqScene.id);
                            }
                            continue timeslotLoop;
                        }
                    }
                }

                // check if Required Staff and Players are available starting at this timeslot
                if (! await this.checkTimeslotUsers(scene, timeslotId)){
                    continue;
                }

                const suggestedLocations = await this.findLocations(scene, timeslotId);
                if (suggestedLocations.length === scene.locations_count){
                    for (let idx = 0; idx < scene.timeslot_count; idx++){
                        foundTimeslots.push(timeslots[timeslotIdx+idx].id);
                    }
                    scene.currentLocations = suggestedLocations;
                    break;
                }
            }
        }

        if (foundTimeslots.length === scene.timeslot_count){
            scene.currentTimeslots = foundTimeslots;
            scene.status = 'scheduled';
            scene.event_id = this.event_id;
            for (const userId of scene.desiredPlayers('required')){
                scene.addPossiblePlayer(userId);
            }
            for (const userId of scene.desiredStaff('required')){
                scene.addPossibleStaff(userId);
            }
            return {slotted: true, conflicts:[]};
        } else {
            scene.currentTimeslots = [];
            scene.clearPlayers();
            scene.clearStaff();
            scene.status = 'ready';
            return {slotted: false, conflicts:conflicts};
        }
    }

    protected async getTimeslotSpan(timeslotId: number, before: number, after:number): Promise<number[]>{
        const timeslotList = [];

        const allTimeslots = await this.cache.timeslots();


        const timeslotIdx = _.indexOf(_.pluck(allTimeslots, 'id'), timeslotId);

        const firstSetupIdx = _.max([0, timeslotIdx - before]);
        for (let i = firstSetupIdx; i < timeslotIdx; i++){
            timeslotList.push(allTimeslots[i].id);
        }

        const lastCleanupIdx = _.min([allTimeslots.length, timeslotIdx + after])
        for (let i = timeslotIdx; i < lastCleanupIdx; i++){
            timeslotList.push(allTimeslots[i].id);
        }

        return timeslotList;
    }

    // Check if required staff/players are signed up for the event
    protected async checkRequiredUsers(scene){
        const allUsers = await this.allAttendeeIds();
        const required = {
            player: scene.desiredPlayers('required'),
            staff: scene.desiredStaff('required')
        }
        for (const type of ['player', 'staff']){
            for (const userId of required[type]){
                if (_.indexOf(allUsers, userId) === -1){
                    const event = await this.cache.event();
                    const user = await models.user.get(event.campaign_id, userId);
                    const issue = `${scene.name} is missing required ${type}: ${user.name}`;
                    if (_.indexOf(this.issues, issue) === -1){
                        this.issues.push(issue);
                    }
                    return false;
                }
            }
        }
        return true;
    }

    // Check if required staff/players are available at a given timeslot
    protected async checkTimeslotUsers(scene, timeslotId){
        const timeslots = await this.cache.timeslots();

        // check timeslotCount future timeslots to see if the required users are available for all of them
        let clear = true;
        const startTimeslotIdx = _.indexOf(_.pluck(timeslots, 'id'), timeslotId);
        checkScene: for(let tIdx = 0; tIdx < scene.timeslot_count; tIdx++){
            const timeslot = timeslots[startTimeslotIdx+tIdx]
            const currentStaff = await this.usersAvailable([timeslot.id], 'staff');
            const requiredStaff = scene.desiredStaff('required');
            for(const userId of requiredStaff){
                // Check if required staff is already allocated to a scene
                if (_.indexOf(currentStaff.allocated, userId) !== -1){
                    clear = false
                    break checkScene;
                }
            }
            // check if we have enough overall staff at this time
            if (currentStaff.min + scene.staff_count.min > currentStaff.all.length){
                clear = false;
                break checkScene;
            }
            const currentPlayers = await this.usersAvailable([timeslot.id], 'player');
            const requiredPlayers = scene.desiredPlayers('required');
            for(const userId of requiredPlayers){
                // Check if required player is already allocated to a scene
                if (_.indexOf(currentPlayers.allocated, userId) !== -1){
                    clear = false
                    break checkScene;
                }
            }

            // check if we have enough overall players at this time
            if (currentPlayers.min + scene.player_count.min > currentPlayers.all.length){
                clear = false;
                break checkScene;
            }

        }

        return clear;
    }

    // Check if workable location(s) are available at the given timeslot(s)
    protected async findLocations(scene: ScheduleScene, timeslotId: number): Promise<number[]>{
        const foundLocations = [];
        const possibleLocationsIds = scene.possibleLocations();
        const locations = await this.cache.locations();
        const timeslots = await this.cache.timeslots();

        const sceneTimeslots = await this.getTimeslotSpan(timeslotId, scene.setup_slots, scene.timeslot_count + scene.cleanup_slots);

        // try to find the desired number of locations
        for (let idx = 0; idx < scene.locations_count; idx++ ){
            // Look at each possible Location
            for (const locationId of possibleLocationsIds){
                // Check if we already have this location
                if (_.indexOf(foundLocations, locationId) !== -1){
                    continue;
                }
                const location = _.findWhere(locations, {id:locationId});

                // check timeslotCount future timeslots to see if this location is clear for all of them
                let clear = true;

                const startTimeslotIdx = _.indexOf(_.pluck(timeslots, 'id'), timeslotId);
                checkScene: for (const timeslotId of sceneTimeslots){

                //checkScene: for(let tIdx = 0; tIdx < scene.timeslot_count; tIdx++){
                    //const timeslot = timeslots[startTimeslotIdx+tIdx]
                    const slotScenes = (await this.getSlotScenes(timeslotId, locationId)).filter(slotScene=>{
                        return slotScene.id !== scene.id;
                    });
                    if (slotScenes.length && !location.multiple_scenes){
                        clear = false;
                        break checkScene;
                    }
                }
                if (clear){
                    foundLocations.push(locationId);
                    break;
                }
            }
        }

        return foundLocations;
    }

    protected async allAttendeeIds(type:string = 'all'): Promise<number[]>{
        let event = null;
        while (!_.has(event, 'attendees')){
            event = await this.cache.event();
        }
        if (type === 'staff'){
            return event.attendees.filter( attendee => {
                return attendee.attending && attendee.user.type !== 'player'
            }).map(attendee => { return attendee.user_id});

        } else if (type === 'player'){
            return event.attendees.filter( attendee => {
                return attendee.attending && attendee.user.type === 'player'
            }).map(attendee => { return attendee.user_id});

        } else {
            return event.attendees.filter( attendee => {
                return attendee.attending;
            }).map(attendee => { return attendee.user_id});
        }
    }


    protected async usersAvailable(timeslots:number[], type:string): Promise<UsersAvailable>{
        let event = null;
        while (!_.has(event, 'attendees')){
            event = await this.cache.event();
        }

        const allAttendeeIds = await this.allAttendeeIds(type);

        const result = {
            all: [],
            available:[],
            allocated:[],
            min: 0,
            max: 0,
            sceneCount: 0
        };

        const data = await async.map(timeslots, async(timeslotId)=>{
            const scenes = this.getTimeslotScenes(timeslotId);
            const result = {
                all: [],
                available:[],
                allocated:[],
                min: 0,
                max: 0,
                sceneCount: scenes.length
            };

            for (const scene of scenes){
                if (type === 'player'){
                    result.min += scene.player_count.min;
                    result.max += scene.player_count.max;
                } else {
                    result.min += scene.staff_count.min;
                    result.max += scene.staff_count.max;
                }
            }

            for (const userId of allAttendeeIds){
                let free = true;
                result.all.push(userId);
                for (const scene of scenes){
                    if (type === 'player'){
                        if (_.indexOf(scene.currentPlayers, userId) !== -1){
                            free = false;
                            break;
                        }
                    } else {
                        if (_.indexOf(scene.currentStaff, userId) !== -1){
                            free = false;
                            break;
                        }
                    }
                }

                if(await models.schedule_busy.findOne({
                    event_id:event.id,
                    user_id: userId,
                    timeslot_id:timeslotId
                })){
                    free = false;
                }

                if (free){
                    result.available.push(userId);
                } else if (_.indexOf(result.allocated, userId) === -1){
                    result.allocated.push(userId);
                }
            }
            return result;
        });

        result.all = _.intersection(..._.pluck(data, 'all'));
        result.allocated = _.union(..._.pluck(data, 'allocated'));
        result.available = _.difference(result.all, result.allocated)
        result.min = _.max(_.pluck(data, 'min'));
        result.max = _.max(_.pluck(data, 'max'));
        return result;
    }

    protected async fillUsers(scene:ScheduleScene, status:string, max:boolean, options:SchedulerOptions):Promise<number>{

        const usersAvailable = {
            players: await this.usersAvailable(scene.currentTimeslots, 'player'),
            staff: await this.usersAvailable(scene.currentTimeslots, 'staff'),
        };
        let requestedPlayers = [];
        let requestedStaff = [];
        if (status === 'any'){
            if (!options.skipPlayers){
                const allPlayers = await this.allAttendeeIds('player');
                const rejectedPlayers = scene.desiredPlayers('rejected');
                requestedPlayers = _.shuffle(allPlayers.filter(id => {
                    return _.indexOf(rejectedPlayers, id) === -1
                }));
            }
            const allStaff = await this.allAttendeeIds('staff');
            const rejectedStaff = scene.desiredPlayers('rejected');
            requestedStaff = _.shuffle(allStaff.filter(id => {
                return _.indexOf(rejectedStaff, id) === -1
            }));

        } else {
            requestedPlayers = _.shuffle(scene.desiredPlayers(status));
            requestedStaff = _.shuffle(scene.desiredStaff(status));
        }

        const maxPlayers = max?scene.player_count.max:scene.player_count.min;
        const maxStaff = max?scene.staff_count.max:scene.staff_count.min;

        let happiness = 0;

        if (!options.skipPlayers){
            for (const userId of requestedPlayers){
                // reject if we have enough users
                if (scene.currentPlayers.length >= maxPlayers){
                    break;
                }
                // Reject if we already have this user
                if (_.indexOf(scene.currentPlayers, userId) !== -1 ){
                    continue;
                }

                // accept if they're available
                if (_.indexOf(usersAvailable.players.available, userId) !== -1){
                    scene.addPossiblePlayer(userId);
                    happiness++;
                }
            }
        }

        for (const userId of requestedStaff){
            // reject if we have enough users
            if (scene.currentStaff.length >= maxStaff){
                break;
            }

            // Rehect if we already have this user
            if (_.indexOf(scene.currentStaff, userId) !== -1 ){
                continue;
            }

            // accept if they're available
            if (_.indexOf(usersAvailable.staff.available, userId) !== -1){
                scene.addPossibleStaff(userId);
                happiness++;
            }
        }
        if (status === 'requested'){
            return happiness * Number(config.get('scheduler.happiness.users_requested'));
        }
        return happiness * Number(config.get('scheduler.happiness.users'));
    }

    protected async fillByCharacter(scene: ScheduleScene, options:SchedulerOptions): Promise<number>{
        if (scene.currentPlayers.length >= scene.player_count.max){
            // Scene is already full
            return 0;
        }

        const desires = {
            sources: {
                required: scene.desiredSources('required'),
                requested: scene.desiredSources('requested')
            },
            skills: {
                required: scene.desiredSkills('required'),
                requested: scene.desiredSkills('requested')
            }
        };

        if (!(
            desires.sources.requested.length +
            desires.sources.required.length +
            desires.skills.requested.length +
            desires.skills.required.length
        )){
            // Nothing requested/required
            return 0;
        }

        const playersAvailable = await this.usersAvailable(scene.currentTimeslots, 'player');
        const rejectedPlayers = scene.desiredPlayers('rejected');

        const currentGroup = await scene.currentGroup();
        const characters = await this.cache.characters();
        const charactersAvailable = characters.filter(character => {
            return _.indexOf(playersAvailable.available, character.user_id) !== -1
        });
        let happiness = 0;

        statusLoop: for (const status of ['required', 'requested'] ){
            for (const type of ['sources', 'skills']){

                itemLoop: for (const itemId of desires[type][status] ){

                    // Check if scene is full
                    if (scene.currentPlayers.length >= scene.player_count.max){
                        break statusLoop;
                    }

                    for (const character of currentGroup){

                        const records = getCharacterData(character, type);
                        if(_.findWhere(records, {id:itemId})){
                            // Scene already has a character with requested skill or source
                            break itemLoop;
                        }
                    }

                    for (const character of charactersAvailable){
                        if (_.indexOf(rejectedPlayers, character.user_id) !== -1){
                            continue;
                        }
                        const records = getCharacterData(character, type)
                        if (_.findWhere(records, {id:itemId})){

                            // Found an available character with required/requested skill/source
                            scene.addPossiblePlayer(character.user_id);
                            happiness++;
                            continue itemLoop; // Move on to the next item of this status/type
                        }
                    }

                }
            }
        }
        return happiness * Number(config.get('scheduler.happiness.character'));
    }
}

function getCharacterData(character:CharacterData, type:string){
    if (!character){
        return;

    }
    if (type === 'sources'){
        return character.sources;
    } else if (type === 'skills'){
        return character.skills;
    } else{
        return;
    }
}



export default Schedule;
