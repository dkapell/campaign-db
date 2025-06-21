'use strict'

import async from 'async'
import _ from 'underscore'
import models from '../models';
import ScheduleCache from './ScheduleCache';


interface CurrentSchedule{
    locations: number[]
    timeslots: number[]
    players: number[]
    staff: number[]
}

class ScheduleScene  {
    id: number;
    score: number;
    happiness: number;
    schedule_status: string;
    private data: SceneModel;
    private current: CurrentSchedule = {
        locations: [],
        timeslots: [],
        players: [],
        staff: []
    };
    protected possibleLocationData: number[] = [];

    protected cache: ScheduleCache;

    constructor(scene: SceneModel, cache:ScheduleCache=null){
        this.data = scene;
        this.id = Number(scene.id);
        this.score = scene.score;
        this.current.timeslots = getCurrent(scene.timeslots);
        this.current.locations = getCurrent(scene.locations);
        this.current.players = getCurrent(scene.users, 'player');
        this.current.staff = getCurrent(scene.users, 'staff');
        this.schedule_status = scene.status==='confirmed'?'slotted':'new';
        this.happiness = 0;
        if (cache){
            this.cache = cache;
        } else {
            this.cache = new ScheduleCache(scene.campaign_id);
        }
    }

    get name(): string {
        return this.data.name;
    }

    get status(): string{
        return this.data.status;
    }

    set status(value:string){
        if (this.data.status !== 'confirmed'){
            this.data.status = value;
        }
    }
    get event_id(): number{
        return this.data.event_id;
    }
    set event_id(id:number){
        this.data.event_id = id;
    }

    /* Timeslots */
    get timeslot_count(): number {
        return this.data.timeslot_count
    }
    get timeslots(): TimeslotModel[] {
        return this.data.timeslots;
    }
    get currentTimeslots(): Array<number> {
        return this.current.timeslots;
    }
    async possibleTimeslots(timeslots:TimeslotModel[]): Promise<number[]>{
        // Build a ordered list of possibilites based on requred > requested
        const requiredTimeslots = _.shuffle(_.pluck(_.where(this.timeslots, {scene_request_status:'required'}), 'id' ));
        const requestedTimeslots = _.shuffle(_.pluck(_.where(this.timeslots, {scene_request_status:'requested'}), 'id' ));
        const scenePossibleTimeslots = [...requiredTimeslots, ...requestedTimeslots];

        const allTimeslots = await this.cache.timeslots();


        // filer possibilities by the ones that allow the full scene time
        const possibleTimeslots = [];
        for (const timeslotId of scenePossibleTimeslots){
            const timeslotIdx = _.indexOf(_.pluck(allTimeslots, 'id'), timeslotId);

            let valid = true;
            // Check all the following timeslots needed for this scene
            for (let idx = 0; idx < this.timeslot_count; idx ++){
                const checkSlotIdx = timeslotIdx + idx;
                const checkSlot = allTimeslots[checkSlotIdx];
                // If past the end of the event, or not a possible timeslot, reject the starting timeslot
                if (checkSlotIdx >= timeslots.length || _.indexOf(scenePossibleTimeslots, checkSlot.id) === -1){
                    valid = false;
                }
            }
            if (valid){
                possibleTimeslots.push(timeslotId);
            }
        }
        return possibleTimeslots;
    }

    set currentTimeslots(arr: number[]){
        this.current.timeslots = arr;
    }
    addPossibleTimeslot(newId: number){
        this.current.timeslots.push(newId)
        this.current.timeslots = _.uniq(this.current.timeslots);
    }
    removePossibleTimeslot(removeId: number){
        const timeslots = [];
        for (const id of this.current.timeslots){
            if (id !== removeId){
                timeslots.push(id);
            }
        }
        this.current.timeslots = timeslots;
    }

    /* Locations */
    get locations_count(): number {
        return this.data.locations_count
    }
    get locations(): LocationModel[] {
        return this.data.locations;
    }
    get currentLocations(): number[] {
        return this.current.locations;
    }
    possibleLocations(regenerate:boolean=false): number[]{
        if (!regenerate && this.possibleLocationData.length){
            return this.possibleLocationData;
        }
        const requiredLocations = _.shuffle(_.pluck(_.where(this.locations, {
                scene_request_status:'required',
                multiple_scenes:false
        }), 'id' ));
        const requiredLocationsMultiple = _.shuffle(_.pluck(_.where(this.locations, {
                scene_request_status:'required',
                multiple_scenes:true
        }), 'id' ));
        const requestedLocations = _.shuffle(_.pluck(_.where(this.locations, {
            scene_request_status:'requested',
            multiple_scenes:false
        }), 'id' ))
        const requestedLocationsMultiple = _.shuffle(_.pluck(_.where(this.locations, {
            scene_request_status:'requested',
            multiple_scenes:true
        }), 'id' ));
        this.possibleLocationData = [...requiredLocations, ...requiredLocationsMultiple, ...requestedLocations, ...requestedLocationsMultiple];
        return this.possibleLocationData;
    }
    set currentLocations(arr:number[]){
        this.current.locations = arr;
    }
    addPossibleLocation(newId: number){
        this.current.locations.push(newId)
        this.current.locations = _.uniq(this.current.locations);
    }
    removePossibleLocation(removeId: number){
        const locations = [];
        for (const id of this.current.locations){
            if (id !== removeId){
                locations.push(id);
            }
        }
        this.current.locations = locations;
    }

    /* Staff */
    get staff_count(): Record<string, number> {
        return {
            min: this.data.staff_count_min,
            max: this.data.staff_count_max
        };
    }
    get staff(): CampaignUser[] {
        return this.data.users.filter(user => { return user.type !== 'player' });
    }
    get currentStaff(): number[] {
        return this.current.staff;
    }
    set currentStaff(arr:number[]){
        this.current.staff = arr;
    }

    addPossibleStaff(userId:number){
        if (_.indexOf(this.current.staff, userId) === -1){
            this.current.staff.push(userId);
        }
    }
    removePossibleStaff(userId:number){
        if (_.indexOf(this.current.staff, userId) !== -1){
            const user = _.findWhere(this.data.users, {id:userId});
            if (!user || user.scene_schedule_status !== 'confirmed'){
                const users = [];
                for (const currentId of this.current.staff){
                    if (currentId !== userId){
                        users.push(userId);
                    }
                }
                this.current.staff = users;
            }
        }
    }
    clearStaff(){
        const users = [];
        for (const userId of this.current.staff){
            const user = _.findWhere(this.data.users, {id:userId});
            if (user && user.scene_request_status === 'confirmed'){
                users.push(userId);
            }
        }
        this.current.staff = users;
    }


    desiredStaff(type:string){
        const users = this.data.users.filter(user => {
            return user.type !== 'player' && user.scene_request_status === type;
        });
        return _.pluck(users, 'id');
    }

    /* Players */
    get player_count(): Record<string, number> {
        return {
            min: this.data.player_count_min,
            max: this.data.player_count_max
        };
    }
    get players(): CampaignUser[] {
        return this.data.users.filter(user => { return user.type === 'player' });
    }
    get currentPlayers(): number[] {
        return this.current.players;
    }
    set currentPlayers(arr:number[]) {
        this.current.players = arr;
    }

    addPossiblePlayer(userId:number){
        if (_.indexOf(this.current.players, userId) === -1){
            this.current.players.push(userId);
        }
    }
    removePossiblePlayer(userId:number){
        if (_.indexOf(this.current.players, userId) !== -1){
            const user = _.findWhere(this.data.users, {id:userId});
            if (!user || user.scene_schedule_status !== 'confirmed'){
                const users = [];
                for (const currentId of this.current.players){
                    if (currentId !== userId){
                        users.push(userId);
                    }
                }
                this.current.players = users;
            }
        }
    }
    clearPlayers(){
        const users = [];
        for (const userId of this.current.players){
            const user = _.findWhere(this.data.users, {id:userId});
            if (user && user.scene_request_status === 'confirmed'){
                users.push(userId);
            }
        }
        this.current.players = users;
    }

    desiredPlayers(type:string){
        const users = this.data.users.filter(user => {
            return user.type === 'player' && user.scene_request_status === type;
        });
        return _.pluck(users, 'id');
    }

    get sources(): SourceModel[] {
        return this.data.sources;
    }
    get skills(): SkillModel[] {
        if (this.data.skills){
            return this.data.skills;
        }
        return [];
    }

    async write(){
        for (const timeslot of this.data.timeslots){
            if (_.indexOf(this.currentTimeslots, timeslot.id) !== -1){
                if (timeslot.scene_schedule_status !== 'confirmed'){
                    timeslot.scene_schedule_status = 'suggested';
                }
            } else {
                timeslot.scene_schedule_status = 'unscheduled';
            }
        }
        for (const location of this.data.locations){
            if (_.indexOf(this.currentLocations, location.id) !== -1){
                if (location.scene_schedule_status !== 'confirmed'){
                    location.scene_schedule_status = 'suggested';
                }
            } else {
                location.scene_schedule_status = 'unscheduled';
            }
        }
        for (const user of this.data.users){
            if (user.scene_schedule_status !== 'confirmed'){
                if (_.indexOf(this.currentPlayers, user.id) !== -1){
                    if (user.scene_schedule_status !== 'confirmed'){
                        user.scene_schedule_status = 'suggested';
                    }
                } else if (_.indexOf(this.currentStaff, user.id) !== -1){
                    if (user.scene_schedule_status !== 'confirmed'){
                        user.scene_schedule_status = 'suggested';
                    }
                } else {
                    user.scene_schedule_status = 'unscheduled';
                }
            }
        }
        for (const userId of [...this.currentPlayers, ...this.currentStaff]){
            if (!_.findWhere(this.data.users, {id:userId})){
                this.data.users.push({id:userId, scene_schedule_status: 'suggested'});
            }
        }

        return models.scene.update(this.id, this.data);
    }

    async clear(){

        if (this.status !== 'confirmed'){
            this.data.status = 'ready';
            this.data.event_id = null;
        }
        for (const timeslot of this.data.timeslots){
            if (timeslot.scene_schedule_status === 'suggested'){
                timeslot.scene_schedule_status = 'unscheduled';
            }
        }
        for (const location of this.data.locations){
            if (location.scene_schedule_status === 'suggested'){
               location.scene_schedule_status = 'unscheduled';
            }
        }
        for (const user of this.data.users){
            if (user.scene_schedule_status === 'suggested'){
                user.scene_schedule_status = 'unscheduled';
            }
        }
        return models.scene.update(this.id, this.data);
    }
}

export default ScheduleScene;

function getCurrent(collection:ModelData[]|CampaignUser[], filter:string=null): number[]{
    const result = [];
    for (const item of collection){
        if (filter){
            if (filter==='player' && item.type!=='player'){
                continue;
            } else if (filter === 'staff' && item.type === 'player'){
                continue;
            }
        }
        if (item.scene_schedule_status === 'confirmed' || item.scene_schedule_status === 'suggested'){
            result.push(Number(item.id))
        }

    }
    return result;
}
