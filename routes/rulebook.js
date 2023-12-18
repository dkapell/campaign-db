const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const moment = require('moment');
const permission = require('../lib/permission');
const Drive = require('../lib/Drive');
const validator = require('validator');
const rulebookHelper = function(){};

/* GET rulebooks listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: `/Campaign/${req.campaign.id}`, name: 'Campaign'},
        ],
        current: 'Rulebooks'
    };
    try {

        const rulebooks = await req.models.rulebook.find({campaign_id:req.campaign.id}, {excludeFields:['data', 'excludes']});
        res.locals.rulebooks = rulebooks.map( (rulebook) => {
            rulebook.generatedFormated = moment(rulebook.generated).format('lll');
            return rulebook;
        });
        res.locals.csrfToken = req.csrfToken();
        res.locals.title += ' - Rulebooks';
        res.render('rulebook/list', { pageTitle: 'Rulebooks' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const rulebook = await req.models.rulebook.get(id);

        if (!rulebook || rulebook.campaign_id !== req.campaign.id){
            throw new Error('Invalid Rulebook');
        }
        rulebook.generatedFormated = moment(rulebook.generated).format('lll');
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/Campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/rulebook', name: 'Rulebooks'},
            ],
            current: rulebook.name
        };
        res.locals.title += ` - Rulebook - ${rulebook.name}`;
        res.render('rulebook/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        const rulebooks = await req.models.rulebook.find({campaign_id:req.campaign.id});
        let maxVal = _.max(_.pluck(rulebooks, 'display_order'));
        res.locals.rulebook = {
            name: null,
            description: null,
            drive_folder: null,
            display_order: _.isFinite(maxVal)?maxVal + 1:1,
            excludes: []
        };

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/Campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/rulebook', name: 'Rulebooks'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'rulebookData')){
            res.locals.rulebook = req.session.rulebookData;
            delete req.session.rulebookData;
        }
        res.locals.title += ' - New Rulebook';
        res.render('rulebook/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const rulebook = await req.models.rulebook.get(id);
        if (!rulebook || rulebook.campaign_id !== req.campaign.id){
            throw new Error('Invalid Rulebook');
        }
        res.locals.rulebook = rulebook;
        if (_.has(req.session, 'rulebookData')){
            res.locals.rulebook = req.session.rulebookData;
            delete req.session.rulebookData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/Campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/rulebook', name: 'Rulebooks'},
            ],
            current: 'Edit: ' + rulebook.name
        };
        res.locals.title += ` - Edit Rulebook - ${rulebook.name}`;
        res.render('rulebook/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const rulebook = req.body.rulebook;

    req.session.rulebookData = rulebook;
    rulebook.campaign_id = req.campaign.id;
    delete rulebook.data;
    delete rulebook.generated;

    try{
        const id = await req.models.rulebook.create(rulebook);
        await req.audit('rulebook', id, 'create', {new:rulebook});
        delete req.session.rulebookData;
        req.flash('success', 'Created Rulebook ' + rulebook.name);

        await generate(req, id);
        res.redirect('/rulebook');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/rulebook/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const rulebook = req.body.rulebook;
    console.log(JSON.stringify(req.body, null, 2));
    req.session.rulebookData = rulebook;
    delete rulebook.data;
    delete rulebook.generated;
    console.log(rulebook.excludes);
    if (!_.has(rulebook, 'excludes')){
        rulebook.excludes = [];
    }

    try {
        const current = await req.models.rulebook.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.rulebook.update(id, rulebook);
        await req.audit('rulebook', id, 'update', {old: current, new:rulebook});
        delete req.session.rulebookData;
        //await generate(req, id);
        req.flash('success', 'Updated Rulebook ' + rulebook.name);
        res.redirect('/rulebook');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/rulebook/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.rulebook.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.rulebook.delete(id);
        await req.audit('rulebook', id, 'delete', {old: current});
        req.flash('success', 'Removed Rulebook');
        res.redirect('/rulebook');
    } catch(err) {
        return next(err);
    }
}

async function rebuild(req, res, next){
    const id = req.params.id;
    try {
        const rulebook = await req.models.rulebook.get(id);
        if (!rulebook || rulebook.campaign_id !== req.campaign.id){
            throw new Error('Invalid Rulebook');
        }
        await generate(req, id);
        req.flash('success', 'Rebuilt Rulebook');
        res.redirect('/rulebook');
    } catch(err) {
        return next(err);
    }
}

async function generate(req, rulebookId){
    const rulebook = await req.models.rulebook.get(rulebookId);
    if (!rulebook.drive_folder){
        return;
    }
    rulebook.data = await Drive.listAll(rulebook.drive_folder, null, true);
    rulebook.generated = new Date();
    await req.models.rulebook.update(rulebookId, rulebook);
    return req.audit('rulebook', rulebookId, 'rebuild');
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
router.put('/:id/rebuild', csrf(), rebuild);
router.delete('/:id', remove);

module.exports = router;
