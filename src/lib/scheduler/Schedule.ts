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

class Schedule {
    scenes: ScheduleScene[];
    event_id: number;
    protected cache: ScheduleCache;

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

    getSlotScenes(timeslotId, locationId): ScheduleScene[]{
        const scenes = [];
        for (const scene of this.scenes){
            if (_.indexOf(scene.currentTimeslots, timeslotId) !== -1 &&
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

    async findLocations(scene: ScheduleScene, timeslotId: number): Promise<number[]>{
        const foundLocations = [];
        const possibleLocationsIds = scene.possibleLocations();
        const locations = await this.cache.locations();
        const timeslots = await this.cache.timeslots();
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
                for(let tIdx = 0; tIdx < scene.timeslot_count; tIdx++){
                    const timeslot = timeslots[startTimeslotIdx+tIdx]
                    const slotScenes = this.getSlotScenes(timeslot.id, locationId).filter(slotScene=>{
                        return slotScene.id !== scene.id;
                    });
                    if (slotScenes.length && !location.multiple_scenes){
                        clear = false;
                    }

                    const currentStaff = await this.usersAvailable([timeslotId], 'staff');
                    const requiredStaff = scene.desiredStaff('required');
                    for(const userId of requiredStaff){
                        // Check if staff is signed up for event
                        if (_.indexOf(currentStaff.all, userId) === -1){
                            continue;
                        }
                        // Check if required staff is already allocated to a scene
                        if (_.indexOf(currentStaff.allocated, userId) !== -1){
                            clear = false
                        }
                    }
                    // check if we have enough overall staff at this time
                    if (currentStaff.min + scene.staff_count.min > currentStaff.all.length){
                        clear = false;
                    }
                    const currentPlayers = await this.usersAvailable([timeslotId], 'player');
                    const requiredPlayers = scene.desiredPlayers('required');
                    for(const userId of requiredPlayers){
                        // Check if staff is signed up for event
                        if (_.indexOf(currentPlayers.all, userId) === -1){
                            continue;
                        }
                        // Check if required staff is already allocated to a scene
                        if (_.indexOf(currentPlayers.allocated, userId) !== -1){
                            clear = false
                        }
                    }
                    // check if we have enough overall staff at this time
                    if (currentPlayers.min + scene.player_count.min > currentPlayers.all.length){
                        clear = false;
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

    async allUserIds(type:string): Promise<number[]>{
        let event = null;
        while (!_.has(event, 'attendees')){
            event = await this.cache.event();
        }
        let allUsers: CampaignUser[];
        if (type === 'staff'){
            allUsers = event.attendees.filter( attendee => {
                return attendee.attending && attendee.user.type !== 'player'
            }).map(attendee => { return attendee.user});
        } else if (type === 'player'){
            allUsers = event.attendees.filter( attendee => {
                return attendee.attending && attendee.user.type === 'player'
            }).map(attendee => { return attendee.user});
        } else {
            return;
        }
        return _.pluck(allUsers, 'id');

    }

    async usersAvailable(timeslots:number[], type:string): Promise<UsersAvailable>{
        let event = null;
        while (!_.has(event, 'attendees')){
            event = await this.cache.event();
        }

        const allUserIds = await this.allUserIds(type);

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

            for (const userId of allUserIds){
                let free = true;
                result.all.push(userId);
                for (const scene of scenes){
                    if (type === 'player'){
                        if (_.indexOf(scene.currentPlayers, userId) !== -1){
                            free = false;
                        }
                    } else {
                        if (_.indexOf(scene.currentStaff, userId) !== -1){
                            free = false;
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


    async scheduleScenes(scenes:ScheduleScene[]): Promise<SchedulerResult>{
        const queue = new ScheduleQueue(scenes);
        let unscheduled = 0;
        let scenesProcessed = 0;
        const start =  (new Date()).getTime()
        let last = start;
        while (queue.length && scenesProcessed < (config.get('scheduler.maxScenesPerRun') as number)){
            scenesProcessed++;
            const scene = queue.next();
            switch (scene.schedule_status){
                case 'new': {
                    const slotted = await this.findSlot(scene);
                    if (slotted){
                        scene.happiness += 25;
                        scene.schedule_status = 'slotted';
                        queue.enqueue(scene.id);
                    } else {
                        unscheduled++;
                    }
                    //console.log(`n ${((new Date()).getTime() - last)}ms ${scene.name}`); last = (new Date()).getTime();
                    break;
                }
                case 'slotted':
                    scene.happiness += await this.fillUsers(scene, 'requested');
                    scene.schedule_status = 'users requested';
                    queue.enqueue(scene.id);
                    //console.log(`s ${((new Date()).getTime() - last)}ms ${scene.name}`); last = (new Date()).getTime();

                    break;
                case 'users requested':
                    scene.happiness += await this.fillUsers(scene, 'any');
                    scene.schedule_status = 'users fill min'
                    queue.enqueue(scene.id);
                    //console.log(`r ${((new Date()).getTime() - last)}ms ${scene.name}`); last = (new Date()).getTime();

                    break;
                case 'users fill min':
                    scene.happiness += await this.fillUsers(scene, 'any', true);
                    scene.schedule_status = 'done'
                    //console.log(`f ${((new Date()).getTime() - last)}ms ${scene.name}`); last = (new Date()).getTime();

                    break;
            }
            this.addScene(scene);
        }
        console.log(`took ${((new Date()).getTime() - start)}ms: ${this.happiness}`);
        return {
            schedule: this,
            unscheduled: unscheduled,
            happiness: this.happiness,
            scenesProcessed: scenesProcessed
        };
    }

    protected async findSlot(scene:ScheduleScene):Promise<boolean>{
        const timeslots = await this.cache.timeslots();
        const possibleTimeslots = await scene.possibleTimeslots(timeslots);

        const foundTimeslots = [];
        for (const timeslotId of possibleTimeslots){
            const suggestedLocations = await this.findLocations(scene, timeslotId);
            if (suggestedLocations.length === scene.locations_count){
                const timeslotIdx = _.indexOf(_.pluck(timeslots, 'id'), timeslotId);
                for (let idx = 0; idx < scene.timeslot_count; idx++){
                    foundTimeslots.push(timeslots[timeslotIdx+idx].id);
                }
                scene.currentLocations = suggestedLocations;
                break;
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
            return true;
        } else {
            scene.currentTimeslots = [];
            scene.currentLocations = [];
            scene.clearPlayers();
            scene.clearStaff();
            scene.status = 'ready';
            return false;
        }
    }

    protected async fillUsers(scene:ScheduleScene, status:string, max:boolean=false):Promise<number>{

        const usersAvailable = {
            players: await this.usersAvailable(scene.currentTimeslots, 'player'),
            staff: await this.usersAvailable(scene.currentTimeslots, 'staff'),
        };

        let requestedPlayers = [];
        let requestedStaff = [];
        if (status === 'any'){
            const allPlayers = await this.allUserIds('player');
            const rejectedPlayers = scene.desiredPlayers('rejected');
            requestedPlayers = _.shuffle(allPlayers.filter(id => {
                return _.indexOf(rejectedPlayers, id) === -1
            }));
            const allStaff = await this.allUserIds('staff');
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

        let score = 0;
        //console.log(`${scene.name}: [${scene.currentPlayers}] [${requestedPlayers}] [${usersAvailable.players.available}]`)
        //console.log(`${scene.name}: [${scene.currentStaff}] [${requestedStaff}] [${usersAvailable.staff.available}]`)


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
                score++;
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
                score++;
            }
        }
        return score * (status==='requested'?2:1);
    }
}

export default Schedule;
