import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import permission from '../../lib/permission';

/* GET timeslots listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
        ],
        current: 'Timeslots'
    };
    try {

        res.locals.timeslots = await req.models.timeslot.find({campaign_id:req.campaign.id});
        res.locals.csrfToken = req.csrfToken();
        res.locals.title += ' - Timeslots';
        res.render('admin/timeslot/list', { pageTitle: 'Timeslots' });
    } catch (err){
        next(err);
    }
}

/*
async function show(req, res, next){
    const id = req.params.id;
    try{
        const timeslot = await req.models.timeslot.get(id);

        if (!timeslot || timeslot.campaign_id !== req.campaign.id){
            throw new Error('Invalid Rulebook');
        }
        timeslot.generatedFormated = moment(timeslot.generated).format('lll');
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/timeslot', name: 'Rulebooks'},
            ],
            current: timeslot.name
        };
        res.locals.title += ` - Rulebook - ${timeslot.name}`;
        res.render('timeslot/show');
    } catch(err){
        next(err);
    }
}
*/

async function showNew(req, res, next){
    try{

        res.locals.timeslot = {
            day: null,
            start_hour: null,
            start_minute: 0,
            length: 60,
            type: 'regular'
        };

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/timeslot', name: 'Timeslots'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'timeslotData')){
            res.locals.timeslot = req.session.timeslotData;
            delete req.session.timeslotData;
        }
        res.locals.title += ' - New Timeslot';
        res.render('admin/timeslot/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const timeslot = await req.models.timeslot.get(id);
        if (!timeslot || timeslot.campaign_id !== req.campaign.id){
            throw new Error('Invalid Timeslot');
        }
        res.locals.timeslot = timeslot;
        if (_.has(req.session, 'timeslotData')){
            res.locals.timeslot = req.session.timeslotData;
            delete req.session.timeslotData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/timeslot', name: 'Timeslots'},
            ],
            current: `Edit: ${timeslot.name}`
        };
        res.locals.title += ` - Edit Timeslot - ${timeslot.name}`;
        res.render('admin/timeslot/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const timeslot = req.body.timeslot;

    req.session.timeslotData = timeslot;
    timeslot.campaign_id = req.campaign.id;

    try{
        const id = await req.models.timeslot.create(timeslot);
        await req.audit('timeslot', id, 'create', {new:timeslot});
        delete req.session.timeslotData;
        req.flash('success', `Created Timeslot`);
        res.redirect('/admin/timeslot');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/admin/timeslot/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const timeslot = req.body.timeslot;
    req.session.timeslotData = timeslot;

    try {
        const current = await req.models.timeslot.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.timeslot.update(id, timeslot);
        await req.audit('timeslot', id, 'update', {old: current, new:timeslot});
        delete req.session.timeslotData;
        req.flash('success', `Updated Timeslot: ${timeslot.name}`);
        res.redirect('/admin/timeslot');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/admin/timeslot/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.timeslot.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.timeslot.delete(id);
        await req.audit('timeslot', id, 'delete', {old: current});
        req.flash('success', 'Removed Timeslot');
        res.redirect('/admin/timeslot');
    } catch(err) {
        return next(err);
    }
}

const router = express.Router();

router.use(permission('admin'));
router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.get('/', csrf(), list);
router.get('/new', csrf(), showNew);
router.get('/:id', csrf(), showEdit);
router.get('/:id/edit', csrf(),showEdit);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.delete('/:id', remove);

export default router;
