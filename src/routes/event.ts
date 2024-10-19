import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import permission from '../lib/permission';

/* GET events listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Events'
    };
    try {
        res.locals.events = await req.models.event.find({campaign_id:req.campaign.id, deleted:false});
        res.locals.title += ' - Events';
        res.render('event/list', { pageTitle: 'Events' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const event = await req.models.event.get(id);
        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Tag');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Event'},
            ],
            current: event.name
        };
        res.locals.event = event;
        res.locals.title += ` - Event - ${event.name}`;
        res.render('event/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        res.locals.event = {
            name: null,
            description: null,
            start_time: null,
            end_time: null,
            registration_open: false,
            cost: 0,
            location: null
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Events'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'eventData')){
            res.locals.event = req.session.eventData;
            delete req.session.eventData;
        }
        res.locals.title += ' - New Event';
        res.render('event/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const event = await req.models.event.get(id);
        if (!event || event.campaign_id !== req.campaign.id){
            throw new Error('Invalid Event');
        }
        res.locals.event = event;
        if (_.has(req.session, 'eventData')){
            res.locals.event = req.session.eventData;
            delete req.session.eventData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/event', name: 'Events'},
            ],
            current: 'Edit: ' + event.name
        };
        res.locals.title += ` - Edit Event - ${event.name}`;
        res.render('event/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const event = req.body.event;

    req.session.eventData = event;
    if (!_.has(event, 'registration_open')){
        event.registration_open = false;
    }
    event.campaign_id = req.campaign.id;

    try{
        const id = await req.models.event.create(event);
        await req.audit('event', id, 'create', {new:event});
        delete req.session.eventData;
        req.flash('success', 'Created Event ' + event.name);
        res.redirect('/event');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/event/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const event = req.body.event;
    req.session.eventData = event;

    if (!_.has(event, 'registration_open')){
        event.registration_open = false;
    }

     if (!_.has(event, 'cost') || event.cost === ''){
        event.cost = 0
    }

    try {
        const current = await req.models.event.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        if (current.deleted){
            throw new Error('Can not edit deleted record');
        }

        await req.models.event.update(id, event);
        await req.audit('event', id, 'update', {old: current, new:event});
        delete req.session.eventData;
        req.flash('success', 'Updated Event ' + event.name);
        res.redirect('/event');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/event/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.event.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        current.deleted = true;
        await req.models.event.update(id, current);
        await req.audit('event', id, 'delete', {old: current});
        req.flash('success', 'Removed Event');
        res.redirect('/event');
    } catch(err) {
        return next(err);
    }
}

const router = express.Router();

router.use(permission('gm'));
router.use(function(req, res, next){
    res.locals.siteSection='gm';
    next();
});

router.get('/', list);
router.get('/new', csrf(), showNew);
router.get('/:id', csrf(), show);
router.get('/:id/edit', csrf(),showEdit);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.delete('/:id', permission('admin'), remove);

export default router;
