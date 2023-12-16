const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const validator = require('validator');

/* GET skill_types listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/skill', name: 'Skills'},
        ],
        current: 'Types'
    };
    try {
        res.locals.skill_types = await req.models.skill_type.find({campaign_id: req.campaign.id});
        res.locals.title += ' - Skill Types';
        res.render('skill_type/list', { pageTitle: 'Skill Types' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const skill_type = await req.models.skill_type.get(id);
        if (!skill_type || skill_type.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Type');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_type', name: 'Types'},
            ],
            current: skill_type.name
        };
        res.locals.skills = await req.models.skill.find({source_id:id});
        res.locals.title += ` - Skill Type - ${skill_type.name}`;
        res.render('skill_type/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        res.locals.skill_type = {
            name: null,
            description: null,
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_type', name: 'Types'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'skill_typeData')){
            res.locals.skill_type = req.session.skill_typeData;
            delete req.session.skill_typeData;
        }
        res.locals.title += ' - New Skill Type';
        res.render('skill_type/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const skill_type = await req.models.skill_type.get(id);
        if (!skill_type || skill_type.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Type');
        }
        res.locals.skill_type = skill_type;
        if (_.has(req.session, 'skill_typeData')){
            res.locals.skill_type = req.session.skill_typeData;
            delete req.session.skill_typeData;
        }

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_type', name: 'Types'},
            ],
            current: 'Edit: ' + skill_type.name
        };
        res.locals.title += ` - Edit Skill Type - ${skill_type.name}`;
        res.render('skill_type/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const skill_type = req.body.skill_type;

    req.session.skill_typeData = skill_type;
    skill_type.campaign_id = req.campaign.id;

    try{
        const id = await req.models.skill_type.create(skill_type);
        await req.audit('skill_type', id, 'create', {new:skill_type});
        delete req.session.skill_typeData;
        req.flash('success', 'Created Type ' + skill_type.name);
        res.redirect('/skill_type');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/skill_type/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const skill_type = req.body.skill_type;
    req.session.skill_typeData = skill_type;

    try {
        const current = await req.models.skill_type.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        await req.models.skill_type.update(id, skill_type);
        await req.audit('skill_type', id, 'update', {old: current, new:skill_type});
        delete req.session.skill_typeData;
        req.flash('success', 'Updated Type ' + skill_type.name);
        res.redirect('/skill_type');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/skill_type/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.skill_type.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.skill_type.delete(id);
        await req.audit('skill_type', id, 'delete', {old: current});
        req.flash('success', 'Removed Types');
        res.redirect('/skill_type');
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
