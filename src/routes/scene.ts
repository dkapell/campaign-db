import express from 'express';
import async from 'async';
import _ from 'underscore';
import permission from '../lib/permission';
import Graph from 'tarjan-graph';
import scheduleHelper from '../lib/scheduleHelper';

/* GET scenes listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Scenes'
    };
    try {
        res.locals.scenes = await req.models.scene.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Scenes';
        res.render('scene/list', { pageTitle: 'Scenes' });
    } catch (err){
        next(err);
    }
}


async function show(req, res, next){
    const id = req.params.id;
    try{
        const scene = await req.models.scene.get(id);
        if (!scene || scene.campaign_id !== req.campaign.id){
            throw new Error('Invalid Scene');
        }
        if (req.query.api){
            if (req.checkPermission('gm')){
                return res.json({scene:scheduleHelper.formatScene(scene)});
            } else if (scene.status === 'confirmed'){
                return res.json({
                    scene: scheduleHelper.formatScene(scene, !req.checkPermission('event'))
                });
            } else {
                return res.json({});
            }
        } else {
            if (!(req.checkPermission('gm') || scene.status === 'confirmed')){
                req.flash('error', 'Permission Denied');
                return res.redirect('/');
            }
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/scene', name: 'Scenes'}
            ],
            current: scene.name
        };
        res.locals.scene = scheduleHelper.formatScene(scene, !req.checkPermission('event'));
        if (req.checkPermission('gm')){
            res.locals.scene.issues = await scheduleHelper.validateScene(scene);
        }
        res.locals.title += ` - Scene - ${scene.name}`;
        res.render('scene/show');
    } catch(err){
        next(err);
    }
}

async function validate(req, res){
    const id = req.params.id;
    try{
        const scene = await req.models.scene.get(id);
        if (!scene || scene.campaign_id !== req.campaign.id){
            throw new Error('Invalid Scene');
        }
        const issues = await scheduleHelper.validateScene(scene);
        res.json({success:true, issues:issues});
    } catch(err){
        res.json({success:false, error:err.message})
    }
}

async function showNew(req, res, next){
    try{
        if (req.query.clone){
            const scene = await req.models.scene.get(req.query.clone);
            if (!scene || scene.campaign_id !== req.campaign.id){
                throw new Error('Invalid Scene');
            }
            delete scene.id;
            scene.name += ' (Copy)';
            res.locals.scene = scene;

            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/scene', name: 'Scenes'},
                ],
                current: `Clone: ${scene.name}`
            };
        } else {
            res.locals.scene = {
                name: null,
                player_name: null,
                event_id: null,
                status: 'new',
                description: null,
                schedule_notes: null,
                display_to_pc: true,
                prereqs:[],
                player_count_min: 2,
                player_count_max: 8,
                staff_count_min:1,
                staff_count_max:4,
                combat_staff_count_min:null,
                combat_staff_count_max:null,
                timeslot_count: req.campaign.default_scene_slots,
                setup_slots: req.campaign.default_setup_slots,
                cleanup_slots: req.campaign.default_cleanup_slots,
                locations_count: 1,
                staff_url:null,
                player_url:null,
                tags:[],
                locations:[],
                users:[],
                sources:[],
                timeslots:[],
                skills:[]
            };

            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/scene', name: 'Scenes'},
                ],
                current: 'New'
            };
        }

        const campaign_users = await req.models.campaign_user.find({campaign_id:req.campaign.id});
        let users = await async.map(campaign_users, async (campaign_user) => {
            const user = await req.models.user.get(req.campaign.id, campaign_user.user_id);
            return user;
        });
        users = users.filter(user => { return user.type !== 'none'});
        users = await async.map(users, async(user)=>{
            if (user.type === 'player'){
                user.character = await req.models.character.findOne({user_id: user.id, active: true, campaign_id:req.campaign.id});
            }
            return user;
        });
        res.locals.users = _.sortBy(users, 'typeForDisplay')
        res.locals.locations = await req.models.location.find({campaign_id:req.campaign.id});
        res.locals.sources = await req.models.skill_source.find({campaign_id:req.campaign.id});
        res.locals.timeslots = await req.models.timeslot.find({campaign_id:req.campaign.id});
        res.locals.scenes = await req.models.scene.find({campaign_id:req.campaign.id});
        res.locals.tags = await req.models.tag.find({campaign_id:req.campaign.id, type:'scene'});
        res.locals.events = (await req.models.event.find({campaign_id:req.campaign.id, deleted:false}, {postSelect:async (data)=>{return data;}})).reverse();

        const skills = await req.models.skill.find({campaign_id:req.campaign.id});
        res.locals.skills = skills.filter(skill => {
            return skill.status.purchasable;
        });

        if (_.has(req.session, 'sceneData')){
            res.locals.scene = await prepForm(req);
        }
        res.locals.title += ' - New Scene';
        res.render('scene/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;

    try{
        const scene = await req.models.scene.get(id);
        if (!scene || scene.campaign_id !== req.campaign.id){
            throw new Error('Invalid Scene');
        }
        res.locals.scene = scene;
        if (_.has(req.session, 'sceneData')){
            res.locals.scene = await prepForm(req);
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/scene', name: 'Scenes'},
                { url: `/scene/${scene.id}`, name: scene.name }
            ],
            current: 'Edit: ' + scene.name
        };

        const campaign_users = await req.models.campaign_user.find({campaign_id:req.campaign.id});
        let users = await async.map(campaign_users, async (campaign_user) => {
            const user = await req.models.user.get(req.campaign.id, campaign_user.user_id);
            return user;
        });
        users = users.filter(user => { return user.type !== 'none'});
        users = await async.map(users, async(user)=>{
            if (user.type === 'player'){
                user.character = await req.models.character.findOne({user_id: user.id, active: true, campaign_id:req.campaign.id});
            }
            return user;
        });
        res.locals.users = _.sortBy(users, 'typeForDisplay')
        res.locals.locations = await req.models.location.find({campaign_id:req.campaign.id});
        res.locals.sources = await req.models.skill_source.find({campaign_id:req.campaign.id});
        res.locals.timeslots = await req.models.timeslot.find({campaign_id:req.campaign.id});
        res.locals.scenes = await req.models.scene.find({campaign_id:req.campaign.id});
        res.locals.tags = await req.models.tag.find({campaign_id:req.campaign.id, type:'scene'});
        res.locals.events = (await req.models.event.find({campaign_id:req.campaign.id, deleted:false}, {postSelect:async (data)=>{return data;}})).reverse();

        const skills = await req.models.skill.find({campaign_id:req.campaign.id});
        res.locals.skills = skills.filter(skill => {
            return skill.status.purchasable;
        });

        if (req.query.backto && ['list', 'scene'].indexOf(req.query.backto) !== -1){
            res.locals.backto = req.query.backto;
        }

        res.locals.title += ` - Edit Scene - ${scene.name}`;
        res.render('scene/edit');
    } catch(err){
        next(err);
    }
}

async function prepForm(req){
    const scene = req.session.sceneData;
    delete req.session.sceneData;
    scene.locations = await async.map(scene.locations, async (item) => {
        const record = await req.models.location.get(item.id);
        record.scene_request_status = item.scene_request_status;
        record.scene_schedule_status = item.scene_schedule_status;
        return record;
    });
    scene.timeslots = await async.map(scene.timeslots, async (item) => {
        const record = await req.models.timeslot.get(item.id);
        record.scene_request_status = item.scene_request_status;
        record.scene_schedule_status = item.scene_schedule_status;
        return record;
    });
    scene.users = await async.map(scene.users, async (item) => {
        const record = await req.models.user.get(req.campaign.id, item.id);
        record.scene_request_status = item.scene_request_status;
        record.scene_schedule_status = item.scene_schedule_status;
        record.scene_details = item.scene_details;
        return record;
    });
    scene.sources = await async.map(scene.sources, async (item) => {
        const record = await req.models.skill_source.get(item.id);
        record.scene_request_status = item.scene_request_status;
        record.scene_schedule_status = item.scene_schedule_status;
        return record;
    });
    scene.sources = await async.map(scene.skills, async (item) => {
        const record = await req.models.skill.get(item.id);
        record.scene_request_status = item.scene_request_status;
        record.scene_schedule_status = item.scene_schedule_status;
        return record;
    });
    return scene;
}

async function create(req, res){
    try {
        const scene = await prepSceneData(req);

        scene.campaign_id = req.campaign.id;
        req.session.sceneData = scene;

        const id = await req.models.scene.create(scene);
        await req.audit('scene', id, 'create', {new:scene});
        delete req.session.sceneData;
        req.flash('success', 'Created Scene ' + scene.name);
        res.redirect('/scene');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/scene/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    try {
        const current = await req.models.scene.get(id);
        const scene: SceneModel = await prepSceneData(req, current);
        req.session.sceneData = scene;
        scene.campaign_id = req.campaign.id;
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        await checkPrereqs(req, scene);
        await req.models.scene.update(id, scene);
        await req.audit('scene', id, 'update', {old: current, new:scene});
        if (scene.event_id){
            await scheduleHelper.saveScheduleScene(scene.event_id, id);
        }
        if (current.event_id && Number(current.event_id) !== Number(scene.event_id)){
            await scheduleHelper.saveSchedule(current.event_id, 'current');
        }
        delete req.session.sceneData;
        req.flash('success', 'Updated Scene ' + scene.name);
        if (req.body.backto && req.body.backto==='list'){
            res.redirect('/scene');
        } else {
            res.redirect(`/scene/${id}`);
        }
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/scene/${id}/edit`));

    }
}

async function prepSceneData(req, current:SceneModel=null): Promise<ModelData>{
    const scene = req.body.scene;
    for (const field of ['display_to_pc']){
        if (!_.has(scene, field)){
            scene[field] = false;
        }
    }
    for (const field of ['combat_staff_count_min', 'combat_staff_count_max']){
        if (!_.has(scene, field) || scene[field] === ''){
            scene[field] = null;
        }
    }

    for (const field of ['tags', 'prereqs']){
        if (!scene[field]){
            scene[field] = [];
        } else if(!_.isArray(scene[field])){
            scene[field] = [scene[field]];
        }

        scene[field] = (scene[field] as number[]).map(item => {
            if (!isNaN(item)){
                return Number(item);
            }
            return item;
        });
    }

    if (scene.event_id === "-1"){
        scene.event_id = null;
    }

    for (const field of ['locations', 'timeslots', 'sources', 'skills', 'users']){
        const records = [];
        for (const item in scene[field]){
            const itemId = item.replace(/^id-/, '');
            if (itemId === 'new'){
                continue;
            }
            records.push({
                id: itemId,
                scene_request_status: scene[field][item].request_status,
                scene_details: scene[field][item].scene_details
            });
        }
        scene[field] = records;
    }

    if (current) {
        for (const user of current.users){
            if (!_.findWhere(scene.users, {id:''+user.id})){
                console.log('could not find ' + user.name)
                user.scene_request_status = 'none';
                scene.users.push(user);
            }
        }
    }

    return scene;
}
async function checkPrereqs(req, scene){
    if (scene.prereqs.length){
        const graph = new Graph();
        await addScene(scene.id, scene.prereqs);

        async function addScene(sceneId, prereqs){
            graph.add(sceneId, prereqs);
            if (graph.hasCycle()){
                throw new Error('Cycle Found in Prereqs');
            }
            for (const prereqId of prereqs){
                const prereq = await req.models.scene.get(prereqId);
                if (prereq.prereqs.length){
                    await addScene(prereqId, _.pluck(prereq.prereqs, 'id'));
                }
            }
        }
    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.scene.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.scene.delete(id);
        if (current.event_id){
            await scheduleHelper.removeScheduleScene(current.event_id, id);
        }
        await req.audit('scene', id, 'delete', {old: current});
        req.flash('success', 'Removed Scene');
        res.redirect('/scene');
    } catch(err) {
        return next(err);
    }
}

const router = express.Router();

router.use(function(req, res, next){
    if (!req.campaign.display_schedule){
        req.flash('error', 'Event Schedules are not active on this campaign')
        return res.redirect('/');
    }
    res.locals.siteSection='event';
    next();
});

router.get('/', permission('gm'), list);
router.get('/new', permission('gm'), showNew);
router.get('/:id', permission('player'), show);
router.get('/:id/validate', permission('gm'), validate);
router.get('/:id/edit', permission('gm'), showEdit);
router.post('/', permission('gm'), create);
router.put('/:id', permission('gm'), update);
router.delete('/:id', permission('gm'), remove);

export default router;
