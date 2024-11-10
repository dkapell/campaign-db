import express from 'express';
import csrf from 'csurf';
import async from 'async';
import config from 'config';
import _ from 'underscore';
import permission from '../../lib/permission';
import campaignHelper from '../../lib/campaignHelper';

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

function showNew(req, res){
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
        display_cp: false,
        default_site:false,
        body_font: null,
        header_font: null,
        menu_dark: true,
        cp_base: 25,
        cp_cap: 50,
        cp_factor: 0,
        cp_approval: true,
        event_default_cost: 0,
        event_default_location: null,
        event_fields: [],
        timezone: 'America/New_York',
        user_type_map: {
            'admin': { name: 'core staff', order: 0 },
            'core staff': { name: 'core staff', order: 0 },
            'contributing staff': { name: 'contributing staff', order: 1 },
            'event staff':  { name: 'event staff', order: 3 },
            'player':  { name: 'player', order: 2 },
        }
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
        if(!campaign.user_type_map){
            campaign.user_type_map = {
            'admin': { name: 'core staff', order: 0 },
            'core staff': { name: 'core staff', order: 0 },
            'contributing staff': { name: 'contributing staff', order: 1 },
            'event staff':  { name: 'event staff', order: 3 },
            'player':  { name: 'player', order: 2 },
            };
        }
            /*[
                { type: 'admin', name: 'core staff', order: 0 },
                { type: 'core staff', name: 'core staff', order: 0 },
                { type: 'contributing staff', name: 'contributing staff', order: 1 },
                { type: 'event staff', name: 'event staff', order: 3 },
                { type: 'player', name: 'player', order: 2 }
            ];
        }*/

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

async function create(req, res){
    if (!req.campaign.default_site){
        req.flash('error', 'Must be on admin site to create new campaign');
        return res.redirect('/');
    }
    const campaign = req.body.campaign;

    req.session.campaignData = campaign;

    for(const field of ['display_map', 'display_glossary', 'display_cp', 'default_to_player', 'menu_dark', 'cp_approval']){
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

async function update(req, res){
    const id = req.params.id;
    const campaign = req.body.campaign;
    req.session.campaignData = campaign;
    for(const field of ['display_map', 'display_glossary', 'display_cp', 'default_to_player', 'default_site', 'menu_dark', 'cp_approval']){
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
    if (campaign.event_fields === null || campaign.event_fields === ''){
        campaign.event_fields = JSON.stringify([]);
    }

    try {
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

export default router;
