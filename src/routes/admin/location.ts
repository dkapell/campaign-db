import express from 'express';
import _ from 'underscore';
import permission from '../../lib/permission';

/* GET locations listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
        ],
        current: 'Locations'
    };
    try {

        res.locals.locations = await req.models.location.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Locations';
        res.render('admin/location/list', { pageTitle: 'Locations' });
    } catch (err){
        next(err);
    }
}

/*
async function show(req, res, next){
    const id = req.params.id;
    try{
        const location = await req.models.location.get(id);

        if (!location || location.campaign_id !== req.campaign.id){
            throw new Error('Invalid Rulebook');
        }
        location.generatedFormated = moment(location.generated).format('lll');
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/location', name: 'Rulebooks'},
            ],
            current: location.name
        };
        res.locals.title += ` - Rulebook - ${location.name}`;
        res.render('location/show');
    } catch(err){
        next(err);
    }
}
*/

async function showNew(req, res, next){
    try{

        res.locals.location = {
            name: null,
            multiple_scenes: false,
            tags: [],
        };

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/location', name: 'Locations'},
            ],
            current: 'New'
        };

        res.locals.tags = await req.models.tag.find({campaign_id:req.campaign.id, type:'location'});

        if (_.has(req.session, 'locationData')){
            res.locals.location = req.session.locationData;
            delete req.session.locationData;
        }
        res.locals.title += ' - New Location';
        res.render('admin/location/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;

    try{
        const location = await req.models.location.get(id);
        if (!location || location.campaign_id !== req.campaign.id){
            throw new Error('Invalid Location');
        }
        res.locals.location = location;
        if (_.has(req.session, 'locationData')){
            res.locals.location = req.session.locationData;
            delete req.session.locationData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/location', name: 'Locations'},
            ],
            current: 'Edit: ' + location.name
        };
        res.locals.tags = await req.models.tag.find({campaign_id:req.campaign.id, type:'location'});
        res.locals.title += ` - Edit Location - ${location.name}`;
        res.render('admin/location/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const location = req.body.location;

    req.session.locationData = location;
    location.campaign_id = req.campaign.id;

    for (const field of ['multiple_scenes', 'combat']){
        if (!_.has(location, field)){
            location[field] = false;
        }
    }
    if (!location.tags){
        location.tags = [];
    } else if(!_.isArray(location.tags)){
        location.tags = [location.tags];
    }
    location.tags = location.tags.map(tag => {
        if (!isNaN(tag)){
            return Number(tag);
        }
        return tag;
    });

    try{    
        const locations = await req.models.location.find({campaign_id:req.campaign.id});
        const maxVal = _.max(_.pluck(locations, 'display_order'));
        location.display_order = _.isFinite(maxVal)?maxVal + 1:1;

        const id = await req.models.location.create(location);
        await req.audit('location', id, 'create', {new:location});
        delete req.session.locationData;
        req.flash('success', 'Created Location ' + location.name);
        res.redirect('/admin/location');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/admin/location/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const location = req.body.location;
    req.session.locationData = location;

    for (const field of ['multiple_scenes', 'combat']){
        if (!_.has(location, field)){
            location[field] = false;
        }
    }
    if (!location.tags){
        location.tags = [];
    } else if(!_.isArray(location.tags)){
        location.tags = [location.tags];
    }
    location.tags = location.tags.map(tag => {
        if (!isNaN(tag)){
            return Number(tag);
        }
        return tag;
    });

    try {
        const current = await req.models.location.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        location.campaign_id = req.campaign.id;
        await req.models.location.update(id, location);
        await req.audit('location', id, 'update', {old: current, new:location});
        delete req.session.locationData;
        req.flash('success', 'Updated Location ' + location.name);
        res.redirect('/admin/location');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/admin/location/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.location.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.location.delete(id);
        await req.audit('location', id, 'delete', {old: current});
        req.flash('success', 'Removed Location');
        res.redirect('/admin/location');
    } catch(err) {
        return next(err);
    }
}

async function reorder(req, res, next){
    try {
        for (const update of req.body){
            const location = await req.models.location.get(update.id);
            if (!location || location.campaign_id !== req.campaign.id){
                throw new Error ('Invalid record');
            }
            location.display_order = update.display_order;
            await req.models.location.update(update.id, location);
        }
        res.json({success:true});
    }catch (err) {
        return next(err);
    }
}

const router = express.Router();

router.use(permission('admin'));
router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.get('/', list);
router.get('/new', showNew);
router.get('/:id', showEdit);
router.get('/:id/edit', showEdit);
router.post('/', create);
router.put('/order', reorder);
router.put('/:id', update);
router.delete('/:id', remove);

export default router;
