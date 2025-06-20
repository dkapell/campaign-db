'use strict'
import async from 'async';
import models from '../models';

class ScheduleCache {
    protected event_id;
    protected campaign_id;
    protected cache = {
        timeslots: [],
        locations: [],
        event: null,
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
        const event = await models.event.get(this.event_id, {postSelect: async(data)=>{return data}});
        this.cache.event = event;
        return this.cache.event;
    }

    async fill(){
        await async.parallel([
            async() => {this.event()},
            async() => {this.timeslots()},
            async() => {this.locations()}
        ]);
    }

}

export default ScheduleCache;
