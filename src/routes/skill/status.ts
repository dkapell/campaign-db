import express from 'express';
import _ from 'underscore';
import permission from '../../lib/permission';

/* GET skill_statuss listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/skill', name: 'Skills'},
        ],
        current: 'Statuses'
    };
    try {
        res.locals.skill_statuses = await req.models.skill_status.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Skill Statuses';
        res.render('skill_status/list', { pageTitle: 'Skill Statuses' });
    } catch (err){
        next(err);
    }
}

/*
async function show(req, res, next){
    const id = req.params.id;
    try{
        const skill_status = await req.models.skill_status.get(id);
        if (!skill_status || skill_status.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Status');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_status', name: 'Statuses'},
            ],
            current: skill_status.name
        };
        res.locals.skills = await req.models.skill.find({source_id:id});
        res.locals.title += ` - Skill Status - ${skill_status.name}`;
        res.render('skill_status/show');
    } catch(err){
        next(err);
    }
}
*/

async function showNew(req, res, next){
    try{
        res.locals.skill_status = {
            name: null,
            description: null,
            display_to_pc: false,
            class: 'secondary',
            advanceable: true,
            purchasable: false,
            reviewable: false,
            ready: false,
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skills', name: 'Skills'},
                { url: '/skill_status', name: 'Statuses'},
            ],
            current: 'New'
        };

        if (_.has(req.session, 'skill_statusData')){
            res.locals.skill_status = req.session.skill_statusData;
            delete req.session.skill_statusData;
        }
        res.locals.title += ' - New Skill Status';
        res.render('skill_status/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;

    try{
        const skill_status = await req.models.skill_status.get(id);
        if (!skill_status || skill_status.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Status');
        }
        res.locals.skill_status = skill_status;
        if (_.has(req.session, 'skill_statusData')){
            res.locals.skill_status = req.session.skill_statusData;
            delete req.session.skill_statusData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_status', name: 'Statuses'},
            ],
            current: 'Edit: ' + skill_status.name
        };
        res.locals.title += ` - Edit Skill Status - ${skill_status.name}`;
        res.render('skill_status/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const skill_status = req.body.skill_status;

    req.session.skill_statusData = skill_status;
    for (const field of ['display_to_pc', 'advanceable', 'purchasable', 'reviewable', 'complete']){
        if (!_.has(skill_status, field)){
            skill_status[field] = false;
        }
    }
    skill_status.campaign_id = req.campaign.id;

    try{
        const skill_statuses = await req.models.skill_status.find({campaign_id:req.campaign.id});
        const maxVal = _.max(_.pluck(skill_statuses, 'display_order'));
        skill_status.display_order = _.isFinite(maxVal)?maxVal + 1:1;

        const id = await req.models.skill_status.create(skill_status);
        await req.audit('skill_status', id, 'create', {new:skill_status});
        delete req.session.skill_statusData;
        req.flash('success', 'Created Status ' + skill_status.name);
        res.redirect('/skill_status');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/skill_status/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const skill_status = req.body.skill_status;
    req.session.skill_statusData = skill_status;
    for (const field of ['display_to_pc', 'advanceable', 'purchasable', 'reviewable', 'complete']){
        if (!_.has(skill_status, field)){
            skill_status[field] = false;
        }
    }

    try {
        const current = await req.models.skill_status.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.skill_status.update(id, skill_status);
        await req.audit('skill_status', id, 'update', {old: current, new:skill_status});
        delete req.session.skill_statusData;
        req.flash('success', 'Updated Status ' + skill_status.name);
        res.redirect('/skill_status');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/skill_status/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.skill_status.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.skill_status.delete(id);
        await req.audit('skill_status', id, 'delete', {old: current});
        req.flash('success', 'Removed Status');
        res.redirect('/skill_status');
    } catch(err) {
        return next(err);
    }
}

async function reorder(req, res, next){
    try {
        for (const update of req.body){
            const skill_status = await req.models.skill_status.get(update.id);
            if (!skill_status || skill_status.campaign_id !== req.campaign.id){
                throw new Error ('Invalid record');
            }
            skill_status.display_order = update.display_order;
            await req.models.skill_status.update(update.id, skill_status);
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
