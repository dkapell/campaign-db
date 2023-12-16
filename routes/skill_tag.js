const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const validator = require('validator');

/* GET skill_tags listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/skill', name: 'Skills'},
        ],
        current: 'Tags'
    };
    try {
        res.locals.skill_tags = await req.models.skill_tag.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Skill Tags';
        res.render('skill_tag/list', { pageTitle: 'Skill Tags' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const skill_tag = await req.models.skill_tag.get(id);
        if (!skill_tag || skill_tag.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Tag');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_tag', name: 'Tags'},
            ],
            current: skill_tag.name
        };
        res.locals.skills = await req.models.skill.find({source_id:id});
        res.locals.title += ` - Skill Tag - ${skill_tag.name}`;
        res.render('skill_tag/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        res.locals.skill_tag = {
            name: null,
            description: null,
            color: null
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skills', name: 'Skills'},
                { url: '/skill_tag', name: 'Tags'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'skill_tagData')){
            res.locals.skill_tag = req.session.skill_tagData;
            delete req.session.skill_tagData;
        }
        res.locals.title += ' - New Skill Tag';
        res.render('skill_tag/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const skill_tag = await req.models.skill_tag.get(id);
        if (!skill_tag || skill_tag.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Tag');
        }
        res.locals.skill_tag = skill_tag;
        if (_.has(req.session, 'skill_tagData')){
            res.locals.skill_tag = req.session.skill_tagData;
            delete req.session.skill_tagData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_tag', name: 'Tags'},
            ],
            current: 'Edit: ' + skill_tag.name
        };
        res.locals.title += ` - Edit Skill Tag - ${skill_tag.name}`;
        res.render('skill_tag/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const skill_tag = req.body.skill_tag;

    req.session.skill_tagData = skill_tag;
    if (!_.has(skill_tag, 'display_to_pc')){
        skill_tag.display_to_pc = false;
    }
    if (!_.has(skill_tag, 'on_sheet')){
        skill_tag.on_sheet = false;
    }
    skill_tag.campaign_id = req.campaign.id;

    try{
        const id = await req.models.skill_tag.create(skill_tag);
        await req.audit('skill_tag', id, 'create', {new:skill_tag});
        delete req.session.skill_tagData;
        req.flash('success', 'Created Tag ' + skill_tag.name);
        res.redirect('/skill_tag');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/skill_tag/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const skill_tag = req.body.skill_tag;
    req.session.skill_tagData = skill_tag;
    if (!_.has(skill_tag, 'display_to_pc')){
        skill_tag.display_to_pc = false;
    }
    if (!_.has(skill_tag, 'on_sheet')){
        skill_tag.on_sheet = false;
    }

    try {
        const current = await req.models.skill_tag.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.skill_tag.update(id, skill_tag);
        await req.audit('skill_tag', id, 'update', {old: current, new:skill_tag});
        delete req.session.skill_tagData;
        req.flash('success', 'Updated Tag ' + skill_tag.name);
        res.redirect('/skill_tag');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/skill_tag/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.skill_tag.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.skill_tag.delete(id);
        await req.audit('skill_tag', id, 'delete', {old: current});
        req.flash('success', 'Removed Tag');
        res.redirect('/skill_tag');
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
