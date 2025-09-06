'use strict'
import async from 'async';
import _ from 'underscore';
import models from '../models';
import Character from '../Character';

class ScheduleCache {
    protected event_id;
    protected campaign_id;
    protected cache = {
        timeslots: [],
        locations: [],
        event: null,
        characters: [],
        schedule_busys:[],
        users: []
    };

    constructor(campaignId:number, eventId:number = null){
        this.event_id = eventId;
        this.campaign_id = campaignId
    }

    async locations():Promise<LocationModel[]>{
        if (this.cache.locations.length){
            return JSON.parse(JSON.stringify(this.cache.locations));
        }
        if (!this.campaign_id){
            const event = await this.event();
            this.campaign_id = event.campaign_id;
        }
        const locations = await models.location.find({campaign_id:this.campaign_id});
        this.cache.locations = locations;
        return JSON.parse(JSON.stringify(this.cache.locations));
    }

    async timeslots():Promise<TimeslotModel[]>{
        if (this.cache.timeslots.length){
            return JSON.parse(JSON.stringify(this.cache.timeslots));
        }
        if (!this.campaign_id){
            const event = await this.event();
            this.campaign_id = event.campaign_id;
        }
        const timeslots = await models.timeslot.find({campaign_id:this.campaign_id});
        this.cache.timeslots = timeslots;
        return JSON.parse(JSON.stringify(this.cache.timeslots));

    }

    async event(): Promise<EventModel>{
        if (this.cache.event && this.cache.event.id){
            return this.cache.event;
        }
        const event = await models.event.get(this.event_id);
        this.cache.event = event;
        return this.cache.event;
    }

    async characters(): Promise<CharacterData[]>{
        if (this.cache.characters.length){
            return this.cache.characters;
        }
        const attendees = await models.attendance.find({event_id: this.event_id, attending:true});
        const players = attendees.filter(attendee => {
            return attendee.user.type === 'player' && attendee.character_id;
        });

        this.cache.characters = await async.map(players, async(player) => {
            const character = new Character({id: player.character_id});
            await character.init();
            return character.data();
        });
        return this.cache.characters;
    }
    async schedule_busys(): Promise<ScheduleBusyModel[]>{
        if (this.cache.schedule_busys.length){
            return this.cache.schedule_busys;
        }
        if (this.event_id){
            this.cache.schedule_busys = await models.schedule_busy.find({event_id:this.event_id})
        } else {
            this.cache.schedule_busys = await models.schedule_busy.find({campaign_id:this.campaign_id})
        }

        return this.cache.schedule_busys;
    }

    async users(): Promise<CampaignUser[]>{
        if (this.cache.users.length){
            return this.cache.users;
        }
        const users = await models.user.find(this.campaign_id);
        this.cache.users = users;
        return this.cache.users;
    }

    async user(userId): Promise<CampaignUser>{
        if (this.cache.users.length){
            return _.findWhere(this.cache.users, {id:userId});
        }
        return models.user.get(this.campaign_id, userId);
    }

    async fill(){
        await async.parallel([
            async() => {this.event()},
            async() => {this.timeslots()},
            async() => {this.locations()},
            async() => {this.characters()},
            async() => {this.schedule_busys()},
            async() => {this.users()}
        ]);
    }

}

export default ScheduleCache;
