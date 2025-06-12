import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import permission from '../../lib/permission';

/* GET schedule_busy_types listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
        ],
        current: 'Schedule Busy Types'
    };
    try {

        res.locals.schedule_busy_types = await req.models.schedule_busy_type.find({campaign_id:req.campaign.id});
        res.locals.csrfToken = req.csrfToken();
        res.locals.title += ' - Schedule Busy Types';
        res.render('admin/schedule_busy_type/list', { pageTitle: 'Schedule Busy Types' });
    } catch (err){
        next(err);
    }
}

/*
async function show(req, res, next){
    const id = req.params.id;
    try{
        const schedule_busy_type = await req.models.schedule_busy_type.get(id);

        if (!schedule_busy_type || schedule_busy_type.campaign_id !== req.campaign.id){
            throw new Error('Invalid Rulebook');
        }
        schedule_busy_type.generatedFormated = moment(schedule_busy_type.generated).format('lll');
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/schedule_busy_type', name: 'Rulebooks'},
            ],
            current: schedule_busy_type.name
        };
        res.locals.title += ` - Rulebook - ${schedule_busy_type.name}`;
        res.render('schedule_busy_type/show');
    } catch(err){
        next(err);
    }
}
*/

async function showNew(req, res, next){
    try{

        res.locals.schedule_busy_type = {
            name: null,
            description: null,
            display_to_player: true,
            available_to_player: true,
            available_to_staff: true,
        };

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/schedule_busy_type', name: 'Schedule Busy Types'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'schedule_busy_typeData')){
            res.locals.schedule_busy_type = req.session.schedule_busy_typeData;
            delete req.session.schedule_busy_typeData;
        }
        res.locals.title += ' - New Schedule Busy Type';
        res.render('admin/schedule_busy_type/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const schedule_busy_type = await req.models.schedule_busy_type.get(id);
        if (!schedule_busy_type || schedule_busy_type.campaign_id !== req.campaign.id){
            throw new Error('Invalid Schedule Busy Type');
        }
        res.locals.schedule_busy_type = schedule_busy_type;
        if (_.has(req.session, 'schedule_busy_typeData')){
            res.locals.schedule_busy_type = req.session.schedule_busy_typeData;
            delete req.session.schedule_busy_typeData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/schedule_busy_type', name: 'Schedule Busy Types'},
            ],
            current: `Edit: ${schedule_busy_type.name}`
        };
        res.locals.title += ` - Edit Schedule Busy Type - ${schedule_busy_type.name}`;
        res.render('admin/schedule_busy_type/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const schedule_busy_type = req.body.schedule_busy_type;

    req.session.schedule_busy_typeData = schedule_busy_type;
    schedule_busy_type.campaign_id = req.campaign.id;

    for (const field of ['display_to_player', 'available_to_player', 'available_to_staff']){
        if (!_.has(schedule_busy_type, field)){
            schedule_busy_type[field] = null;
        }
    }

    try{
        const id = await req.models.schedule_busy_type.create(schedule_busy_type);
        await req.audit('schedule_busy_type', id, 'create', {new:schedule_busy_type});
        delete req.session.schedule_busy_typeData;
        req.flash('success', `Created Schedule Busy Type`);
        res.redirect('/admin/schedule_busy_type');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/admin/schedule_busy_type/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const schedule_busy_type = req.body.schedule_busy_type;
    req.session.schedule_busy_typeData = schedule_busy_type;

    for (const field of ['display_to_player', 'available_to_player', 'available_to_staff']){
        if (!_.has(schedule_busy_type, field)){
            schedule_busy_type[field] = null;
        }
    }
    
    try {
        const current = await req.models.schedule_busy_type.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.schedule_busy_type.update(id, schedule_busy_type);
        await req.audit('schedule_busy_type', id, 'update', {old: current, new:schedule_busy_type});
        delete req.session.schedule_busy_typeData;
        req.flash('success', `Updated Schedule Busy Type: ${schedule_busy_type.name}`);
        res.redirect('/admin/schedule_busy_type');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/admin/schedule_busy_type/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.schedule_busy_type.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.schedule_busy_type.delete(id);
        await req.audit('schedule_busy_type', id, 'delete', {old: current});
        req.flash('success', 'Removed Schedule Busy Type');
        res.redirect('/admin/schedule_busy_type');
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
