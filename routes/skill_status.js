const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const validator = require('validator');

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
        res.locals.skill_statuss = await req.models.skill_status.list();
        res.locals.title += ' - Skill Statuses';
        res.render('skill_status/list', { pageTitle: 'Skill Statuses' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const skill_status = await req.models.skill_status.get(id);
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

async function showNew(req, res, next){
    try{
        const skill_statuss = await req.models.skill_status.find();
        const maxVal = _.max(_.pluck(skill_statuss, 'display_order'));
        res.locals.skill_status = {
            name: null,
            description: null,
            display_to_pc: false,
            display_order: maxVal +1,
            class: 'secondary',
            advanceable: true,
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skills', name: 'Skills'},
                { url: '/skill_status', name: 'Statuses'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

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
    res.locals.csrfToken = req.csrfToken();

    try{
        const skill_status = await req.models.skill_status.get(id);
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

async function create(req, res, next){
    const skill_status = req.body.skill_status;

    req.session.skill_statusData = skill_status;
    for (const field of ['display_to_pc', 'advanceable', 'purchasable']){
        if (!_.has(skill_status, field)){
            skill_status[field] = false;
        }
    }

    try{
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

async function update(req, res, next){
    const id = req.params.id;
    const skill_status = req.body.skill_status;
    req.session.skill_statusData = skill_status;
    for (const field of ['display_to_pc', 'advanceable', 'purchasable']){
        if (!_.has(skill_status, field)){
            skill_status[field] = false;
        }
    }

    try {
        const current = await req.models.skill_status.get(id);

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
        await req.models.skill_status.delete(id);
        await req.audit('skill_status', id, 'delete', {old: current});
        req.flash('success', 'Removed Statueses');
        res.redirect('/skill_status');
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

router.get('/', list);
router.get('/new', csrf(), showNew);
router.get('/:id', csrf(), showEdit);
router.get('/:id/edit', csrf(),showEdit);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.delete('/:id', remove);

module.exports = router;
