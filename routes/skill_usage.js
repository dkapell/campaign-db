const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const validator = require('validator');

/* GET skill_usages listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/skill', name: 'Skills'},
        ],
        current: 'Usages'
    };
    try {
        res.locals.skill_usages = await req.models.skill_usage.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Skill Usages';
        res.render('skill_usage/list', { pageTitle: 'Skill Usages' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const skill_usage = await req.models.skill_usage.get(id);
        if (!skill_usage || skill_usage.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Usage');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_usage', name: 'Usages'},
            ],
            current: skill_usage.skill_usage
        };
        res.locals.skills = await req.models.skill.find({source_id:id});
        res.locals.title += ` - Skill Usage - ${skill_usage.name}`;
        res.render('skill_usage/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        const skill_usages = await req.models.skill_usage.find({campaign_id:req.campaign.id});
        const maxVal = _.max(_.pluck(skill_usages, 'display_order'));
        res.locals.skill_usage = {
            name: null,
            description: null,
            display_name: true,
            display_order: maxVal +1
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skills', name: 'Skills'},
                { url: '/skill_usage', name: 'Usages'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'skill_usageData')){
            res.locals.skill_usage = req.session.skill_usageData;
            delete req.session.skill_usageData;
        }
        res.locals.title += ' - New Skill Usage';
        res.render('skill_usage/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const skill_usage = await req.models.skill_usage.get(id);
        if (!skill_usage || skill_usage.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Usage');
        }
        res.locals.skill_usage = skill_usage;
        if (_.has(req.session, 'skill_usageData')){
            res.locals.skill_usage = req.session.skill_usageData;
            delete req.session.skill_usageData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_usage', name: 'Usages'},
            ],
            current: 'Edit: ' + skill_usage.name
        };
        res.locals.title += ` - Edit Skill Usage - ${skill_usage.name}`;
        res.render('skill_usage/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const skill_usage = req.body.skill_usage;

    req.session.skill_usageData = skill_usage;
    if (!_.has(skill_usage, 'display_name')){
        skill_usage.display_name = false;
    }
    skill_usage.campaign_id = req.campaign.id;
    try{
        const id = await req.models.skill_usage.create(skill_usage);
        await req.audit('skill_usage', id, 'create', {new:skill_usage});
        delete req.session.skill_usageData;
        req.flash('success', 'Created Usage ' + skill_usage.name);
        res.redirect('/skill_usage');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/skill_usage/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const skill_usage = req.body.skill_usage;
    req.session.skill_usageData = skill_usage;
    if (!_.has(skill_usage, 'display_name')){
        skill_usage.display_name = false;
    }

    try {
        const current = await req.models.skill_usage.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.skill_usage.update(id, skill_usage);
        await req.audit('skill_usage', id, 'update', {old: current, new:skill_usage});
        delete req.session.skill_usageData;
        req.flash('success', 'Updated Usage ' + skill_usage.name);
        res.redirect('/skill_usage');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/skill_usage/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.skill_usage.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.skill_usage.delete(id);
        await req.audit('skill_usage', id, 'delete', {old: current});
        req.flash('success', 'Removed Usages');
        res.redirect('/skill_usage');
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
router.get('/:id', csrf(), showEdit);
router.get('/:id/edit', csrf(),showEdit);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.delete('/:id', permission('admin'), remove);

module.exports = router;
