import _ from 'underscore';
import async from 'async';
import scheduleHelper from '../../lib/scheduleHelper';

async function showSchedule(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();
    try {
        const event = await req.models.event.get(id);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        const scenes = (await req.models.scene.find({campaign_id:req.campaign.id})).filter(scene => {
            // Scene assigned to a different event
            if (scene.event_id && scene.event_id !== event.id){
                return false;
            }
            // Scene is not ready for scheduling
            if (scene.status === 'new' || scene.status === 'postponed'){
                return false;
            }
            return true;
        });
        res.locals.scenes = await async.map(scenes, async (scene) => {
            scene.issues = await scheduleHelper.validateScene(scene);
            return scene;
        });
        res.locals.locations = await req.models.location.find({campaign_id:req.campaign.id});
        res.locals.timeslots = await req.models.timeslot.find({campaign_id:req.campaign.id});
        res.locals.event = event;
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Events'},
                { url: `/event/${event.id}`, name: event.name}
            ],
            current: 'Schedule'
        };
        res.locals.wideMain = true;
        res.locals.title += ` ${event.name} - Schedule`;
        res.render('event/schedule');

    } catch (err){
        return next(err);
    }
}

async function updateScene(req, res){
    const eventId = req.params.id;
    const sceneId = req.params.sceneId;
    const sceneData = req.body.scene;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        const scene = await req.models.scene.get(sceneId);
        if (!scene || scene.campaign_id !== req.campaign.id){
            throw new Error('Invalid Scene');
        }
        //console.log(JSON.stringify(sceneData, null, 2));

        let scheduled = false;

        const locations = await req.models.location.find({campaign_id:req.campaign.id});


        for (const location of locations){
            const locationData = _.findWhere(scene.locations, {id:location.id});
            if (_.indexOf(sceneData.locations, location.id) !== -1){
                scheduled = true;
                console.log('true because of location')
                if (locationData){
                    locationData.scene_schedule_status = 'suggested';
                } else {
                    scene.locations.push({
                        id:location.id,
                        scene_schedule_status: 'suggested'
                    });
                }
            } else if (locationData){
                locationData.scene_schedule_status = 'unscheduled';
            }
        }

        const timeslots = await req.models.timeslot.find({campaign_id:req.campaign.id})
        const startTimeslotIdx  = _.findIndex(timeslots, timeslot => {return timeslot.id === sceneData.timeslot});

        if (sceneData.timeslot !== 'none'){
            scheduled = true;
            console.log('trrue because of timestamp')

        }
        for (let idx = 0; idx < timeslots.length; idx++ ){
            const timeslot = timeslots[idx];
            const timeslotData = _.findWhere(scene.timeslots, {id: timeslot.id});
            if (idx >= startTimeslotIdx && idx < startTimeslotIdx + scene.timeslot_count){

                if (timeslotData){
                     timeslotData.scene_schedule_status = 'suggested';
                } else {
                    scene.timeslots.push({
                        id: timeslot.id,
                        scene_schedule_status: 'suggested'
                    });
                }
            } else if (timeslotData){
                timeslotData.scene_schedule_status = 'unscheduled';
            }

        }

        if (scheduled){
            scene.event_id = eventId;
            scene.status = 'scheduled';
        } else {
            scene.event_id = null;
            scene.status = 'ready'
        }

        //console.log(scene);

        await req.models.scene.update(sceneId, scene);

        return res.json({success:true, scene:scene});

    } catch (err){
        return res.json({success:false, error:err.message});
    }
}

async function validateScenes(req, res){
    const eventId = req.params.id;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        const sceneIds = req.query.scenes.split(/\s*,\s*/);

        const scenes = await async.map(sceneIds, async(sceneId) => {
            const scene = await req.models.scene.get(sceneId);
            if (!scene) { return null; }
            return {
                id: scene.id,
                issues: await scheduleHelper.validateScene(scene)
            }
        })
        res.json({success:true, scenes:scenes});
    } catch(err) {
        res.json({success:false, error:err.message});
    }
}

export default {
    showSchedule,
    updateScene,
    validateScenes
};
