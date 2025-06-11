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

        let scheduled = false;

        const locations = await req.models.location.find({campaign_id:req.campaign.id});


        for (const location of locations){
            const locationData = _.findWhere(scene.locations, {id:location.id});
            if (_.indexOf(sceneData.locations, location.id) !== -1){
                scheduled = true;
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
        await req.models.scene.update(sceneId, scene);

        return res.json({success:true, scene:scene});

    } catch (err){
        return res.json({success:false, error:err.message});
    }
}

async function confirmScene(req, res){
    const eventId = req.params.id;
    const sceneId = req.params.sceneId;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        const scene = await req.models.scene.get(sceneId);
        if (!scene || scene.campaign_id !== req.campaign.id){
            throw new Error('Invalid Scene');
        }
        if (scene.status !== 'scheduled'){
            throw new Error('Scene is not Scheduled');
        }
        scene.status = 'confirmed';
        for (const type of ['locations', 'timeslots']){
            for (const item of scene[type]){
                if (item.scene_schedule_status === 'suggested'){
                    item.scene_schedule_status = 'confirmed';
                }
            }
        }
        await req.models.scene.update(sceneId, scene);
        return res.json({success:true, scene:scene});

    } catch (err){
        return res.json({success:false, error:err.message});
    }
}

async function unconfirmScene(req, res){
    const eventId = req.params.id;
    const sceneId = req.params.sceneId;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        const scene = await req.models.scene.get(sceneId);
        if (!scene || scene.campaign_id !== req.campaign.id){
            throw new Error('Invalid Scene');
        }
        if (scene.status !== 'confirmed'){
            throw new Error('Scene is not Confirmed');
        }
        scene.status = 'scheduled';
        for (const type of ['locations', 'timeslots']){
            for (const item of scene[type]){
                if (item.scene_schedule_status === 'confirmed'){
                    item.scene_schedule_status = 'suggested';
                }
            }
        }

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

async function getUsersAtTimeslot(req, res){
    const eventId = req.params.id;
    const timeslotId = req.params.timeslotId;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        const timeslot = await req.models.timeslot.get(timeslotId);
        if (!timeslot || timeslot.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        let users = await scheduleHelper.getUsersAtTimeslot(event.id, timeslot.id);
        if (req.query.type && req.query.type.match(/^(player|staff)$/)){
            users = users.filter(user => {
                if (req.query.type === 'player'){
                    return user.type === 'player';
                } else {
                    return user.type !== 'player';
                }
            });
        }
        users = users.map(scheduleHelper.formatUser);

        const scenes = await scheduleHelper.getScenesAtTimeslot(event.id, timeslot.id);

        res.json({success:true, users:users, timeslot:timeslot, scenes: scenes});
    } catch(err) {
        console.trace(err);
        res.json({success:false, error:err.message});
    }
}

async function getUsersPerTimeslot(req, res){
    const eventId = req.params.id;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        const timeslots = await req.models.timeslot.find({campaign_id:req.campaign.id});
        const output = await async.map(timeslots, async(timeslot) => {

            let users = await scheduleHelper.getUsersAtTimeslot(event.id, timeslot.id);
            if (req.query.type && req.query.type.match(/^(player|staff)$/)){
                users = users.filter(user => {
                    if (req.query.type === 'player'){
                        return user.type === 'player';
                    } else {
                        return user.type !== 'player';
                    }
                });
            }
            users = users.map(scheduleHelper.formatUser);

            const scenes = await scheduleHelper.getScenesAtTimeslot(event.id, timeslot.id);

            return {users:users, timeslot:timeslot, scenes: scenes};
        });
        res.json({success:true, timeslots:output});
    } catch(err) {
        console.trace(err);
        res.json({success:false, error:err.message});
    }
}


async function updateUser(req, res){
    const eventId = req.params.id;
    const userId = req.params.userId;
    const userData = req.body.user;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        const user = await req.models.user.get(req.campaign.id, userId);

        if (!user){
            throw new Error('Invalid User');
        }

        if (_.has(userData, 'scene_id')){
            const scene = await req.models.scene.get(userData.scene_id);
            if (!scene || scene.campaign_id !== req.campaign.id){
                throw new Error('Invalid Scene');
            }

            const scene_user = await req.models.scene_user.findOne({scene_id:scene.id, user_id:user.id});
            if (scene_user){
                if (userData.status === 'unscheduled' && scene_user.request_status === 'none'){
                    await req.models.scene_user.delete({scene_id:scene.id, user_id:user.id})
                } else {

                    scene_user.schedule_status = userData.status?userData.status:'suggested';
                    await req.models.scene_user.update({scene_id:scene.id, user_id:user.id}, scene_user);
                }
            } else if (userData.status !== 'unscheduled'){
                await req.models.scene_user.create({
                    scene_id: scene.id,
                    user_id: user.id,
                    schedule_status: userData.status?userData.status:'suggested',
                    request_status:'none'
                });
            }
        }
        res.json({success:true});
    } catch (err){
        console.trace(err);
        res.json({success:false, error:err.message});
    }
}

export default {
    showSchedule,
    updateScene,
    updateUser,
    validateScenes,
    confirmScene,
    unconfirmScene,
    getUsersAtTimeslot,
    getUsersPerTimeslot
};
