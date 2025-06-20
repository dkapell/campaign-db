import _ from 'underscore';
import async from 'async';
import scheduleHelper from '../../lib/scheduleHelper';
import scheduler from '../../lib/scheduler';

async function showScheduler(req, res, next){
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
            current: 'Scheduler'
        };
        res.locals.wideMain = true;
        res.locals.title += ` ${event.name} - Scheduler`;
        res.render('event/scheduler');

    } catch (err){
        return next(err);
    }
}

async function showSchedule(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();
    try {
        const event = await req.models.event.get(id);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        if (event.schedule_status === 'private'){
            req.flash('error', 'The schedule for this event is not available');
            return res.redirect(`/event/${event.id}`);
        } else if (req.checkPermission('player') && event.schedule_status !== 'player visible'){
            req.flash('error', 'The schedule for this event is not available');
            return res.redirect(`/event/${event.id}`);
        }

        const scenes = await req.models.scene.find({campaign_id:req.campaign.id, event_id:event.id, status:'confirmed'})
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

        if (sceneData.timeslot === 'none'){
            for (const timeslot of scene.timeslots){
                timeslot.scene_schedule_status = 'unscheduled';
            }
        } else {
            scheduled = true;
            const startTimeslotIdx  = _.findIndex(timeslots, timeslot => {return timeslot.id === sceneData.timeslot});


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

        const scenes = await async.mapSeries(sceneIds, async(sceneId) => {
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
            throw new Error('Invalid Timeslot');
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
        const schedule_busy_types = await req.models.schedule_busy_type.find({campaign_id:req.campaign.id});
        res.json({
            success: true,
            users: users,
            timeslot: timeslot,
            scenes: scenes,
            schedule_busy_types: schedule_busy_types
        });
    } catch(err) {
        console.trace(err);
        res.json({success:false, error:err.message});
    }
}

async function getBusyUsersAtTimeslot(req, res){
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

        const schedule_busys = await req.models.schedule_busy.find({
            event_id: eventId,
            timeslot_id: timeslot.id
        });

        const users = await async.map(schedule_busys, async (schedule_busy)=> {
            let user = await req.models.user.get(req.campaign.id, schedule_busy.user_id);
            if (user.type === 'player'){
                user.character = await req.models.character.findOne({campaign_id: req.campaign.id, active:true, user_id:user.id});
            }
            user = scheduleHelper.formatUser(user);
            user.busy_id = schedule_busy.id;
            user.busy_name = schedule_busy.type.name;
            return user;
        });
        const schedule_busy_types = await req.models.schedule_busy_type.find({campaign_id:req.campaign.id});
        res.json({
            success:true,
            users:users,
            timeslot: timeslot,
            scenes: [],
            schedule_busy_types: schedule_busy_types
        });
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
        if (userData.type === 'scene'){
            if (!_.has(userData, 'scene_id')){
                throw new Error('Scene Id must be provided');
            }
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

        } else if (userData.type === 'schedule_busy'){
            if (!_.has(userData, 'schedule_busy_type_id')){
                throw new Error('Schedule Busy Type Id must be provided');
            }
            if (!_.has(userData, 'timeslot_id')){
                throw new Error('Timeslot Id must be provided');
            }
            const timeslot = await req.models.timeslot.get(userData.timeslot_id);
            if (!timeslot || timeslot.campaign_id !== req.campaign.id){
                throw new Error('Invalid Timeslot');
            }
            const schedule_busy = await req.models.schedule_busy.findOne({
                event_id:event.id,
                user_id:user.id,
                timeslot_id:userData.timeslot_id
            });
            if (schedule_busy){
                if (schedule_busy.type_id !== Number(userData.schedule_busy_type_id)){
                    throw new Error(`User is already scheduled for ${schedule_busy.type.name} in this Timeslot`);
                }
            } else {
                await req.models.schedule_busy.create({
                    event_id:event.id,
                    user_id:user.id,
                    timeslot_id:userData.timeslot_id,
                    type_id: userData.schedule_busy_type_id
                });
            }
        } else if (userData.type === 'unschedule_busy'){
            if (!_.has(userData, 'schedule_busy_id')){
                throw new Error('Schedule Busy Id must be provided');
            }

            const schedule_busy = await req.models.schedule_busy.get(userData.schedule_busy_id);
            if (schedule_busy){
                await req.models.schedule_busy.delete(schedule_busy.id);
            }
        }
        res.json({success:true});
    } catch (err){
        console.trace(err);
        res.json({success:false, error:err.message});
    }
}

async function exportSchedule(req, res, next){
    const eventId = req.params.id;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        let exportType = req.query.type;
        if (!exportType) {
            exportType = 'staff';
        }
        switch (event.schedule_status){
            case 'private':
                return res.status(403).json({success:false, error: 'Schedule is not live'});
                break;
            case 'staff only':
                if (req.checkPermision('player')){
                    return res.status(403).json({success:false, error: 'Schedule is not live'});
                }
                break;
            case 'player':
                if (req.checkPermision('player')){
                    exportType = 'player';
                }
                break;
        }
        const output = await scheduleHelper.getCsv(eventId, exportType);
        res.attachment(`${event.name} - schedule - ${exportType}.csv`);
        res.end(output);
    } catch (err){
        next(err);
    }
}

async function getUserSchedule(req, res){
    const eventId = req.params.id;
    let userId = req.params.userId;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }

        if (!req.checkPermission('contrib')){
            userId = req.session.activeUser.id
        }

        const user = await req.models.user.get(event.campaign_id, userId);
        if (!user){
            throw new Error('Invalid User');
        }

        const schedule = await scheduleHelper.getUserSchedule(event.id, user.id);
        res.json({success:true, schedule:schedule});
    } catch (err) {
        res.json({success:false, error:err.message})
    }
}

async function runScheduler(req, res){
    const eventId = req.params.id;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        const schedulerData = await scheduler.run(eventId);
        res.json({
            success:true,
            attempts:schedulerData.attempts,
            unscheduled: schedulerData.unscheduled,
            scenes: await schedulerData.schedule.getScenes(),
            happiness: schedulerData.happiness
        });
    } catch (err) {
        res.json({success:false, error:err.message})
    }
}

async function clearSchedule(req, res){
    const eventId = req.params.id;
    try{
        const event = await req.models.event.get(eventId);

        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        const schedulerData = await scheduler.clear(eventId);
        res.json({
            success:true,
            scenes: await schedulerData.schedule.getScenes()
        });
    } catch (err) {
        res.json({success:false, error:err.message})
    }
}


export default {
    showScheduler,
    showSchedule,
    updateScene,
    updateUser,
    validateScenes,
    confirmScene,
    unconfirmScene,
    getUsersAtTimeslot,
    getUsersPerTimeslot,
    getBusyUsersAtTimeslot,
    exportSchedule,
    getUserSchedule,
    runScheduler,
    clearSchedule
};
