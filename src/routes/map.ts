import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import permission from '../lib/permission';
import mapHelper from '../lib/mapHelper';
import uuid from 'uuid';


async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Maps'
    };
    try {

        res.locals.maps = await req.models.map.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Maps';
        res.render('map/list', { pageTitle: 'Maps' });
    } catch (err){
        next(err);
    }
}

async function showCampaignMaps(req, res, next){
    if (!req.campaign.display_map){
        return res.redirect('/');
    }
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Map'
    };
    try {
        const maps = await req.models.map.find({campaign_id:req.campaign.id, display_to_pc:true});
        if (!maps.length){
            return res.redirect('/');
        } else if(maps.length === 1){
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                ],
                current: 'Map'
            };
            res.locals.map = maps[0];
            res.locals.title += ` - Map - ${maps[0].name}`;
            res.render('map/show');
        } else {
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                ],
                current: 'Maps'
            };
            res.locals.maps = maps;
            res.locals.title += ' - Maps';
            res.render('map/showList');
        }
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const map = await req.models.map.get(id);

        if (!map || map.campaign_id !== req.campaign.id){
            throw new Error('Invalid Map');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/map', name: 'Maps'},
            ],
            current: map.name
        };
        if (res.locals.checkPermission('contrib')){
            res.locals.breadcrumbs.path[1].url = '/map/list';
        }
        res.locals.map = map;
        res.locals.title += ` - Map - ${map.name}`;
        res.render('map/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        res.locals.map = {
            name: null,
            description: null,
            image_id: null,
            display_to_pc: false,
            rebuild: false
        };

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/map/list', name: 'Maps'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'mapData')){
            res.locals.map = req.session.mapData;
            delete req.session.mapData;
        }
        res.locals.title += ' - New Map';
        res.locals.images = await req.models.image.find({campaign_id:req.campaign.id, type:'map'});
        res.render('map/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const map = await req.models.map.get(id);
        if (!map || map.campaign_id !== req.campaign.id){
            throw new Error('Invalid Map');
        }
        res.locals.map = map;
        if (_.has(req.session, 'mapData')){
            res.locals.map = req.session.mapData;
            delete req.session.mapData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/map/list', name: 'Maps'},
            ],
            current: 'Edit: ' + map.name
        };
        res.locals.title += ` - Edit Map - ${map.name}`;
        res.locals.images = await req.models.image.find({campaign_id:req.campaign.id, type:'map'});
        res.render('map/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const map = req.body.map;

    req.session.mapData = map;
    map.campaign_id = req.campaign.id;
    map.uuid = uuid.v4();
    map.status = 'new';

    for (const field of ['display_to_pc', 'image_id']){
        if (!_.has(map, field)) {
            map[field] = null;
        }
    }

    try{
        const id = await req.models.map.create(map);
        await req.audit('map', id, 'create', {new:map});
        delete req.session.mapData;
        req.flash('success', 'Created Map ' + map.name);
        res.redirect('/map/list');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/map/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const map = req.body.map;
    req.session.mapData = map;
    delete map.uuid;
    delete map.status;

    for (const field of ['display_to_pc', 'image_id']){
        if (!_.has(map, field)) {
            map[field] = null;
        }
    }

    if (map.rebuild){
        map.status = 'new';
    }

    try {
        const current = await req.models.map.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        if (Number(current.image_id) !== Number(map.image_id)){
            map.status = 'new';
        }

        await req.models.map.update(id, map);
        await req.audit('map', id, 'update', {old: current, new:map});
        delete req.session.mapData;
        req.flash('success', 'Updated Map ' + map.name);
        res.redirect('/map/list');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/map/${id}/edit`));
    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.map.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.map.delete(id);
        await mapHelper.clean(id);
        await req.audit('map', id, 'delete', {old: current});
        req.flash('success', 'Removed Map');
        res.redirect('/map');
    } catch(err) {
        return next(err);
    }
}

const router = express.Router();

router.use(permission());
router.use(function(req, res, next){
    res.locals.siteSection='worldbuilding';
    next();
});

router.get('/', showCampaignMaps);
router.get('/list', permission('contrib'), list);
router.get('/new', permission('gm'), csrf(), showNew);
router.get('/:id', show);
router.get('/:id/edit', permission('gm'), csrf(),showEdit);
router.post('/', permission('gm'), csrf(), create);
router.put('/:id', permission('gm'), csrf(), update);
router.delete('/:id', permission('gm'), remove);

export default router;
