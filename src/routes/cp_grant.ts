import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import permission from '../lib/permission';
import async from 'async';
import campaignHelper from '../lib/campaignHelper';

/* GET cp grants listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Character Point Grants'
    };
    if (!req.campaign.display_cp){
        req.flash('warning', 'Character Point Tracker is not enabled for this Campaign');
        return res.redirect('/');
    }
    try {
        res.locals.csrfToken = req.csrfToken();
        res.locals.title += ' - Character Points';

        const user = req.session.assumed_user ? req.session.assumed_user: req.user;
        if (user.type === 'player'){
            res.locals.grants = await req.models.cp_grant.find({campaign_id:req.campaign.id, user_id:user.id});
            res.locals.cp = await campaignHelper.cpCalculator(user.id, req.campaign.id);
            res.render('cp_grant/listPlayer', { pageTitle: 'Character Point Grants' });

        } else {
            const grants = await req.models.cp_grant.find({campaign_id:req.campaign.id});
            res.locals.grants = await async.map(grants, async (grant) => {
                grant.user = await req.models.user.get(req.campaign.id, grant.user_id);
                return grant;
            });
            res.render('cp_grant/list', { pageTitle: 'Character Point Grants' });
        }
    } catch (err){
        next(err);
    }
}

/*
async function show(req, res, next){
    const id = req.params.id;
    try{
        const grant = await req.models.cp_grant.get(id);
        if (!grant || grant.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character Point Grant');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/cp_grant', name: 'Character Point Grants'},
            ],
            current: grant.content
        };
        res.locals.skills = await req.models.skill.find({source_id:id});
        res.locals.title += ` - Character Point - ${grant.content}`;
        res.render('cp_grant/show');
    } catch(err){
        next(err);
    }
}
*/

async function showNew(req, res, next){
    if (!req.campaign.display_cp){
        req.flash('warning', 'Character Point Tracker is not enabled for this Campaign');
        return res.redirect('/');
    }
    try{
        res.locals.grant = {
            content: null,
            user_id: null,
            amount:0
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/cp_grant', name: 'Character Point Grants'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();
        const users = await req.models.user.find(req.campaign.id);
        res.locals.users = users.filter((user) => {
            return user.type === 'player';
        });

        if (_.has(req.session, 'cpGrantData')){
            res.locals.grant = req.session.cpGrantData;
            delete req.session.cpGrantData;
        }
        res.locals.title += ' - New Character Point Grant';
        res.render('cp_grant/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    if (!req.campaign.display_cp){
        req.flash('warning', 'Character Point Tracker is not enabled for this Campaign');
        return res.redirect('/');
    }
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const grant = await req.models.cp_grant.get(id);
        if (!grant || grant.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character Point Grant');
        }
        res.locals.grant = grant;

        const users = await req.models.user.find(req.campaign.id);
        res.locals.users = users.filter((user) => {
            return user.type === 'player';
        });

        if (_.has(req.session, 'cpGrantData')){
            res.locals.grant = req.session.cpGrantData;
            delete req.session.cpGrantData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/cp_grant', name: 'Character Point Grants'},
            ],
            current: 'Edit CP Grant'
        };
        res.locals.title += ' - Edit Character Point Grant';
        res.render('cp_grant/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const grant = req.body.grant;
    if (!req.campaign.display_cp){
        req.flash('warning', 'Character Point Tracker is not enabled for this Campaign');
        return res.redirect('/');
    }

    req.session.cpGrantData = grant;
    grant.campaign_id = req.campaign.id;
    grant.created = new Date();
    const user = req.session.assumed_user ? req.session.assumed_user: req.user;

    if (user.type === 'player'){
        grant.user_id = user.id;
        if (req.campaign.cp_approval){
            grant.approved = false;
        } else {
            grant.approved = true;
        }
    } else {
        grant.approved = true;
    }

    try{
        const id = await req.models.cp_grant.create(grant);
        await req.audit('cp_grant', id, 'create', {new:grant});
        delete req.session.cpGrantData;
        req.flash('success', 'Created Character Point Grant ' + grant.content);
        res.redirect('/cp_grant');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/cp_grant/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const grant = req.body.grant;
    req.session.cpGrantData = grant;
    if (!req.campaign.display_cp){
        req.flash('warning', 'Character Point Tracker is not enabled for this Campaign');
        return res.redirect('/');
    }

    try {
        const current = await req.models.cp_grant.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.cp_grant.update(id, grant);
        await req.audit('cp_grant', id, 'update', {old: current, new:grant});
        delete req.session.cpGrantData;
        req.flash('success', 'Updated Character Point Grant ' + grant.content);
        res.redirect('/cp_grant');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/cp_grant/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    if (!req.campaign.display_cp){
        req.flash('warning', 'Character Point Tracker is not enabled for this Campaign');
        return res.redirect('/');
    }
    try {
        const current = await req.models.cp_grant.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.cp_grant.delete(id);
        await req.audit('cp_grant', id, 'delete', {old: current});
        req.flash('success', 'Removed Character Points');
        res.redirect('/cp_grant');
    } catch(err) {
        return next(err);
    }
}

async function approveGrant(req, res, next){
    const id = req.params.id;
    if (!req.campaign.display_cp){
        return res.json({error: 'Character Point Tracker is not enabled for this Campaign', success:false});
    }
    try {
        const current = await req.models.cp_grant.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        current.approved = true;
        await req.models.cp_grant.update(id, current);
        await req.audit('cp_grant', id, 'approve', {});
        res.json({success:true});
    } catch(err) {
        return next(err);
    }
}


const router = express.Router();

router.use(permission('player'));
router.use(function(req, res, next){
    if ((req.user as CampaignUser).type === 'player'){
        res.locals.siteSection='character';
    } else {
        res.locals.siteSection='gm';
    }
    next();
});

router.get('/', csrf(), list);
router.get('/new', csrf(), showNew);
router.get('/:id',  permission('gm'), csrf(), showEdit);
router.get('/:id/edit', permission('gm'), csrf(),showEdit);
router.post('/', csrf(), create);
router.put('/:id', permission('gm'), csrf(), update);
router.put('/:id/approve', permission('gm'), csrf(), approveGrant);
router.delete('/:id', permission('admin'), remove);

export default router;
