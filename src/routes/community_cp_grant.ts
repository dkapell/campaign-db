import express from 'express';
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
        current: `Community CP Grants`
    };
    if (!req.campaign.display_community_cp){
        req.flash('warning', 'Community CP Tracker is not enabled for this Campaign');
        return res.redirect('/');
    }
    try {
        res.locals.title += ` - Community CP`;

        const user = req.session.activeUser;
        if (req.checkPermission('contrib, cp grant')){
            const grants = await req.models.community_cp_grant.find({campaign_id:req.campaign.id});
            res.locals.grants = await async.map(grants, async (grant) => {
                if (grant.user_id){
                    grant.user = await req.models.user.get(req.campaign.id, grant.user_id);
                }
                return grant;
            });
        }

        if (user.type === 'player'){
            res.locals.myGrants = await req.models.community_cp_grant.find({campaign_id:req.campaign.id, user_id:user.id});

        } else if (user.type === 'event staff'){
            req.flash('warning', 'Not allowed to view');
            return res.redirect('/');

        }
        res.locals.community_cp = await campaignHelper.communityCpCalculator(user.id, req.campaign.id);

        res.render('community_cp_grant/list', { pageTitle: `Community CP Grants` });

    } catch (err){
        next(err);
    }
}

async function showNew(req, res, next){
    if (!req.campaign.display_community_cp){
        req.flash('warning', 'Community CP Tracker is not enabled for this Campaign');
        return res.redirect('/');
    }
    try{
        const user = req.session.activeUser;
        res.locals.grant = {
            content: null,
            user_id: user.type ==='player'?user.id:null,
            amount:0
        };

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/community_cp_grant', name: `Community CP Grants`},
            ],
            current: 'New'
        };

        const users = await req.models.user.find(req.campaign.id);
        res.locals.users = users.filter((user) => {
            return user.type === 'player';
        });

        if (_.has(req.session, 'cpGrantData')){
            res.locals.grant = req.session.cpGrantData;
            delete req.session.cpGrantData;
        }
        res.locals.title += ` - New Community CP Grant`;
        res.render('community_cp_grant/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    if (!req.campaign.display_community_cp){
        req.flash('warning', 'Community CP Tracker is not enabled for this Campaign');
        return res.redirect('/');
    }

    const id = req.params.id;

    try{
        const grant = await req.models.community_cp_grant.get(id);
        if (!grant || grant.campaign_id !== req.campaign.id){
            throw new Error(`Invalid Community CP Grant`);
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
                { url: '/community_cp_grant', name: `Community CP Grants`},
            ],
            current: `Edit Community CP Grant`
        };
        res.locals.title += ` - Edit Community CP Grant`;
        res.render('community_cp_grant/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const grant = req.body.grant;
    if (!req.campaign.display_community_cp){
        req.flash('warning', 'Community CP Tracker is not enabled for this Campaign');
        return res.redirect('/');
    }

    req.session.cpGrantData = grant;
    grant.campaign_id = req.campaign.id;
    grant.created = new Date();
    grant.updated = new Date();
    const user = req.session.activeUser;

    if (req.checkPermission('gm, cp grant')){
        grant.status = 'approved';
        if (Number(grant.user_id) === -1){
            grant.user_id = null;
        }
    } else if (user.type === 'player'){
        grant.user_id = user.id;
        if (req.campaign.cp_approval){
            grant.status = 'pending';
        } else {
            grant.status = 'approved';
        }
    } else {
        throw new Error(`Can not create Community CP Grants.`)
    }

    try{
        const id = await req.models.community_cp_grant.create(grant);
        await req.audit('community_cp_grant', id, 'create', {new:grant});
        delete req.session.cpGrantData;
        req.flash('success', `Created Community CP Grant ${grant.content}`);
        res.redirect('/community_cp_grant');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/community_cp_grant/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const grant = req.body.grant;
    req.session.cpGrantData = grant;
    if (!req.campaign.display_community_cp){
        req.flash('warning', 'Community CP Tracker is not enabled for this Campaign');
        return res.redirect('/');
    }

    try {
        const current = await req.models.community_cp_grant.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        grant.updated = new Date();

        await req.models.community_cp_grant.update(id, grant);
        await req.audit('community_cp_grant', id, 'update', {old: current, new:grant});
        delete req.session.cpGrantData;
        req.flash('success', `Updated Community CP Grant ${grant.content}`);
        res.redirect('/community_cp_grant');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/community_cp_grant/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    if (!req.campaign.display_community_cp){
        req.flash('warning', 'Community CP Tracker is not enabled for this Campaign');
        return res.redirect('/');
    }
    try {
        const current = await req.models.community_cp_grant.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.community_cp_grant.delete(id);
        await req.audit('community_cp_grant', id, 'delete', {old: current});
        req.flash('success', `Removed Community CP Grant`);
        res.redirect('/community_cp_grant');
    } catch(err) {
        return next(err);
    }
}

async function approveGrant(req, res, next){
    const id = req.params.id;
    if (!req.campaign.display_community_cp){
        return res.json({error: 'Community CP Tracker is not enabled for this Campaign', success:false});
    }
    try {
        const current = await req.models.community_cp_grant.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        current.status = 'approved';
        current.updated = new Date();
        await req.models.community_cp_grant.update(id, current);
        await req.audit('community_cp_grant', id, 'approve', {});
        res.json({success:true});
    } catch(err) {
        return next(err);
    }
}

async function denyGrant(req, res, next){
    const id = req.params.id;
    if (!req.campaign.display_community_cp){
        return res.json({error: 'Community CP Tracker is not enabled for this Campaign', success:false});
    }
    try {
        const current = await req.models.community_cp_grant.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        current.status = 'denied';
        current.updated = new Date();
        await req.models.community_cp_grant.update(id, current);
        await req.audit('community_cp_grant', id, 'denied', {});
        res.json({success:true});
    } catch(err) {
        return next(err);
    }
}


const router = express.Router();

router.use(permission('player'));
router.use(function(req, res, next){
    res.locals.siteSection = 'characters';
    next();
});

router.get('/', list);
router.get('/new', showNew);
router.get('/:id',  permission('gm, cp grant'), showEdit);
router.get('/:id/edit', permission('gm, cp grant'), showEdit);
router.post('/', create);
router.put('/:id', permission('gm, cp grant'), update);
router.put('/:id/approve', permission('gm, cp grant'), approveGrant);
router.put('/:id/deny', permission('gm, cp grant'), denyGrant);
router.delete('/:id', permission('admin'), remove);

export default router;
