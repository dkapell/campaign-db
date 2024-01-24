const express = require('express');
const csrf = require('csurf');
const async = require('async');
const pluralize = require('pluralize');
const config = require('config');
const _ = require('underscore');
const permission = require('../../lib/permission');
const campaignHelper = require('../../lib/campaignHelper');

/* GET campaigns listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Campaigns'
    };
    try {
        const campaigns = await req.models.campaign.find();
        res.locals.campaigns = await async.map(campaigns, async (campaign) => {
            campaign.user = await req.models.user.get(null, campaign.created_by);
            return campaign;
        });
        res.render('admin/campaign/list', { pageTitle: 'Campaigns' });
    } catch (err){
        next(err);
    }
}

function showNew(req, res, next){
    if (!req.campaign.default_site){
        req.flash('error', 'Must be on admin site to create new campaign');
        return res.redirect('/');
    }
    res.locals.campaign = {
        name: null,
        description: null,
        site: null,
        theme: null,
        css: null,
        default_to_player: false,
        display_map: false,
        display_glossary: true,
        default_site:false,
        body_font: null,
        header_font: null,
        menu_dark: true,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/admin/campaign', name: 'Campaigns'},
        ],
        current: 'New'
    };
    res.locals.themes = _.keys(config.get('themes'));
    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'campaignData')){
        res.locals.campaign = req.session.campaignData;
        delete req.session.campaignData;
    }
    res.render('admin/campaign/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const campaign = await req.models.campaign.get(id);
        res.locals.campaign = campaign;
        if (_.has(req.session, 'campaignData')){
            res.locals.campaign = req.session.campaignData;
            delete req.session.campaignData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/admin/campaign', name: 'Campaigns'},
            ],
            current: 'Edit: ' + campaign.name
        };
        res.locals.websiteImages = await req.models.image.find({campaign_id:id, type:'website'});
        res.locals.faviconImages = await req.models.image.find({campaign_id:id, type:'favicon'});
        res.locals.themes = _.keys(config.get('themes'));
        res.render('admin/campaign/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    if (!req.campaign.default_site){
        req.flash('error', 'Must be on admin site to create new campaign');
        return res.redirect('/');
    }
    const campaign = req.body.campaign;

    req.session.campaignData = campaign;

    for(const field of ['display_map', 'display_glossary', 'default_to_player', 'menu_dark']){
        if (!_.has(campaign, field)){
            campaign[field] = false;
        }
    }

    campaign.created_by = req.user.id;

    try{
        const campaignId = await req.models.campaign.create(campaign);
        delete req.session.campaignData;
        await campaignHelper.init(campaignId);
        req.flash('success', `Created Campaign ${campaign.name}`);
        res.redirect('/admin/campaign');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/admin/campaign/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const campaign = req.body.campaign;
    req.session.campaignData = campaign;
    for(const field of ['display_map', 'display_glossary', 'default_to_player', 'default_site', 'menu_dark']){
        if (!_.has(campaign, field)){
            campaign[field] = false;
        }
    }
    for(const field of ['image_id', 'favicon_id']){
        if (!_.has(campaign, field) || campaign[field] === ''){
            campaign[field] = null;
        }
    }
    if (!req.campaign.default_site){
        delete campaign.default_site;
    }

    try {
        const current = await req.models.campaign.get(id);

        await req.models.campaign.update(id, campaign);
        delete req.session.campaignData;
        req.flash('success', `Updated Campaign ${campaign.name}`);
        if (req.campaign.id){
            res.redirect('/');
        } else {
            res.redirect('/admin/campaign');
        }
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/admin/campaign/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.campaign.delete(id);
        req.flash('success', 'Removed Campaign');
        if (req.campaign.id){
            res.redirect('/');
        } else {
            res.redirect('/admin/campaign');
        }
    } catch(err) {
        return next(err);
    }
}

async function checkPermission(req, res, next){
    const id = req.params.id;
    const user = req.session.assumed_user ? req.session.assumed_user: req.user;
    if (!req.session.assumed_user && user.site_admin){
        return next();
    }
    const siteUser = await req.models.user.get(id, user.id);
    if (siteUser.type === 'admin'){
        return next();
    }
    req.flash('error', 'You are not allowed to access that resource');
    res.redirect('/');
}

const router = express.Router();

router.use(permission('admin'));
router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.get('/', list);
router.get('/new', csrf(), permission('site_admin'), showNew);
router.get('/:id', csrf(), checkPermission, showEdit);
router.post('/', csrf(), permission('site_admin'), create);
router.put('/:id', csrf(), checkPermission, update);
router.delete('/:id', checkPermission, remove);

module.exports = router;
