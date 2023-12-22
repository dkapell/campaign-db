const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const validator = require('validator');

/* GET glossary_statuses listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/glossary', name: 'Glossary'},
        ],
        current: 'Statuses'
    };
    try {
        res.locals.csrfToken = req.csrfToken();
        res.locals.glossary_statuses = await req.models.glossary_status.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Glossary Statuses';
        res.render('glossary_status/list', { pageTitle: 'Glossary Statuses' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const glossary_status = await req.models.glossary_status.get(id);
        if (!glossary_status || glossary_status.campaign_id !== req.campaign.id){
            throw new Error('Invalid Glossary Status');
        }

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/glossary', name: 'Glossary'},
                { url: '/glossary_status', name: 'Statuses'},
            ],
            current: glossary_status.name
        };
        res.locals.glossarys = await req.models.glossary.find({source_id:id});
        res.locals.title += ` - Glossary Status- ${glossary_status.name}`;
        res.render('glossary_status/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        const glossary_statuses = await req.models.glossary_status.find({campaign_id:req.campaign.id});
        const maxVal = _.max(_.pluck(glossary_statuses, 'display_order'));
        res.locals.glossary_status = {
            name: null,
            description: null,
            display_to_pc: false,
            class: 'secondary',
            reviewable: false,
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/glossarys', name: 'Glossary'},
                { url: '/glossary_status', name: 'Statuses'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'glossary_statusData')){
            res.locals.glossary_status = req.session.glossary_statusData;
            delete req.session.glossary_statusData;
        }
        res.locals.title += ' - New Glossary Status';
        res.render('glossary_status/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const glossary_status = await req.models.glossary_status.get(id);
        if (!glossary_status || glossary_status.campaign_id !== req.campaign.id){
            throw new Error('Invalid Glossary Status');
        }
        res.locals.glossary_status = glossary_status;
        if (_.has(req.session, 'glossary_statusData')){
            res.locals.glossary_status = req.session.glossary_statusData;
            delete req.session.glossary_statusData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/glossary', name: 'Glossary'},
                { url: '/glossary_status', name: 'Statuses'},
            ],
            current: 'Edit: ' + glossary_status.name
        };
        res.locals.title += ` - Edit Glossary Status- ${glossary_status.name}`;
        res.render('glossary_status/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const glossary_status = req.body.glossary_status;

    req.session.glossary_statusData = glossary_status;
    for (const field of ['display_to_pc', 'reviewable']){
        if (!_.has(glossary_status, field)){
            glossary_status[field] = false;
        }
    }
    glossary_status.campaign_id = req.campaign.id;
    try{
        const glossary_statuses = await req.models.glossary_status.find({campaign_id:req.campaign.id});
        const maxVal = _.max(_.pluck(glossary_statuses, 'display_order')) + 1;
        glossary_status.display_order = _.isFinite(maxVal)?maxVal + 1:1;

        const id = await req.models.glossary_status.create(glossary_status);
        await req.audit('glossary_status', id, 'create', {new:glossary_status});
        delete req.session.glossary_statusData;
        req.flash('success', 'Created Status ' + glossary_status.name);
        res.redirect('/glossary_status');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/glossary_status/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const glossary_status = req.body.glossary_status;
    req.session.glossary_statusData = glossary_status;
    for (const field of ['display_to_pc', 'reviewable']){
        if (!_.has(glossary_status, field)){
            glossary_status[field] = false;
        }
    }

    try {
        const current = await req.models.glossary_status.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.glossary_status.update(id, glossary_status);
        await req.audit('glossary_status', id, 'update', {old: current, new:glossary_status});
        delete req.session.glossary_statusData;
        req.flash('success', 'Updated Status ' + glossary_status.name);
        res.redirect('/glossary_status');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/glossary_status/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.glossary_status.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.glossary_status.delete(id);
        await req.audit('glossary_status', id, 'delete', {old: current});
        req.flash('success', 'Removed Statueses');
        res.redirect('/glossary_status');
    } catch(err) {
        return next(err);
    }
}

async function reorder(req, res, next){
    try {
        for (const update of req.body){
            const glossary_status = await req.models.glossary_status.get(update.id);
            if (!glossary_status || glossary_status.campaign_id !== req.campaign.id){
                throw new Error ('Invalid record');
            }
            glossary_status.display_order = update.display_order;
            await req.models.glossary_status.update(update.id, glossary_status);
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

router.get('/', csrf(), list);
router.get('/new', csrf(), showNew);
router.get('/:id', csrf(), showEdit);
router.get('/:id/edit', csrf(),showEdit);
router.post('/', csrf(), create);
router.put('/order', csrf(), reorder);
router.put('/:id', csrf(), update);
router.delete('/:id', remove);

module.exports = router;
