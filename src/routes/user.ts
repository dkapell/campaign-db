import express from 'express';
import csrf from 'csurf';
import async from 'async';
import _ from 'underscore';
import permission from '../lib/permission';
import campaignHelper from '../lib/campaignHelper';
import surveyHelper from '../lib/surveyHelper';

/* GET users listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Users'
    };
    try {
        if (!req.campaign.default_site){
            const campaign_users = await req.models.campaign_user.find({campaign_id:req.campaign.id});
            let events = await req.models.event.find({campaign_id:req.campaign.id});
            events = events.filter( event => { return event.end_time > new Date(); })
            res.locals.users = await async.map(campaign_users, async (campaign_user) => {
                const user = await req.models.user.get(req.campaign.id, campaign_user.user_id);
                user.cp = await campaignHelper.cpCalculator(user.id, req.campaign.id);
                const userEvents = events.filter(event => {
                    return (_.where(event.attendees, {user_id: user.id, attending:true})).length;
                });
                user.regCount = userEvents.length;
                return user;
            });
            res.locals.title += ' - Users';
            res.render('user/list', { pageTitle: 'Users' });
        } else {
            const campaigns = await req.models.campaign.find();
            const users = await req.models.user.find();
            res.locals.users = await async.map(users, async(user) => {
                user.campaigns = (await req.models.campaign_user.find({user_id: user.id})).map(user_campaign => {
                    const campaign = _.findWhere(campaigns, {id: user_campaign.campaign_id});
                    return {
                        name: campaign.name,
                        type: user_campaign.type,
                        campaign_id: campaign.id
                    };
                });
                return user;
            });
            res.locals.campaigns = campaigns;
            res.render('admin/user/list', { pageTitle: 'All Users' });
        }
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();
    try{

        const user = await req.models.user.get(req.campaign.id, id);
        if (!user){
            return res.status(404);
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/user', name: 'Users'},
            ],
            current: user.name
        };

        const characters = await req.models.character.find({campaign_id: req.campaign.id, user_id: user.id});
        for (const character of characters){
            character.user = user;
        }
        res.locals.surveys = await surveyHelper.getPostEventSurveys(req.campaign.id, user.id);
        res.locals.characters = characters;
        res.locals.user = user;
        res.locals.title += ` - Users - ${user.name}`;
        res.render('user/show');
    } catch(err){
        next(err);
    }
}

function showNew(req, res){
    res.locals.user = {
        name: null,
        email: null,
        type: 'none',
        drive_folder: null,
        staff_drive_folder: null,
        permissions: []
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/user', name: 'User'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'userData')){
        res.locals.user = req.session.userData;
        delete req.session.userData;
    }
    res.locals.title += ' - New User';
    res.render('user/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try {
        const user = await req.models.user.get(req.campaign.id, id);
        res.locals.user = user;
        if (_.has(req.session, 'userData')){
            res.locals.furniture = req.session.userData;
            delete req.session.userData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/user', name: 'Users'},
            ],
            current: 'Edit: ' + user.name
        };
        if (req.query.backto && ['list', 'user'].indexOf(req.query.backto) !== -1){
            res.locals.backto = req.query.backto;
        }
        res.locals.title += ` - Edit User - ${user.name}`;
        res.render('user/edit');

    } catch (err){
        next(err);
    }
}

async function create(req, res){
    const user = req.body.user;

    req.session.userData = user;

    try{
        if (!user.permissions){
            user.permissions = [];
        } else if(!_.isArray(user.permissions)){
            user.permissions = [user.permissions];
        }

        await req.models.user.findOrCreate(req.campaign.id, user, true);
        delete req.session.userData;
        req.flash('success', 'Created User ' + user.name);
        res.redirect('/user');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/user/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const user = req.body.user;
    req.session.userData = user;

    try {
        const current = await req.models.user.get(req.campaign.id, id);

        const currentUser = req.session.activeUser;
        if (! (currentUser.type === 'admin' || current.site_admin)){
            delete user.name;
            delete user.email;
            delete user.type;
        }

        if (!user.permissions){
            user.permissions = [];
        } else if(!_.isArray(user.permissions)){
            user.permissions = [user.permissions];
        }

        await req.models.user.update(req.campaign.id, id, user);
        delete req.session.userData;
        req.flash('success', 'Updated User ' + current.name);
        if (req.body.backto && req.body.backto==='list'){
            res.redirect('/user');
        } else {
            res.redirect(`/user/${id}/`);
        }
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/user/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.user.delete(req.campaign.id, id);
        req.flash('success', 'Removed User');
        res.redirect('/user');
    } catch(err) {
        return next(err);
    }
}

async function assume(req, res, next){
    try{
        const user = await req.models.user.get(req.campaign.id, req.params.id);
        if (!user){
            req.flash('error', 'No User Found');
            return res.redirect('/user');
        }
        req.session.assumed_user = user;
        res.redirect('/');
    } catch (err) {
        next(err);
    }
}

function revert(req, res){
    delete req.session.assumed_user;
    res.redirect('/');
}

async function getCharacterListApi(req, res, next){
    const id = req.params.id;
    try{
        const user = await req.models.user.get(req.campaign.id, id);
        if (!user){
            return res.status(404).json({success:false, message: 'not found'});
        }

        const characters = await req.models.character.find({campaign_id: req.campaign.id, user_id: user.id});
        res.json({success:true, characters:characters, user:user});
    } catch (err) {
        next(err);
    }
}

const router = express.Router();

router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.get('/', permission('gm'), list);
router.get('/new', permission('admin'), csrf(), showNew);
router.get('/revert', revert);
router.get('/:id', permission('gm'), csrf(), show);
router.get('/:id/edit', permission('gm'), csrf(), showEdit);
router.get('/:id/assume', permission('gm'), assume);
router.get('/:id/characters', permission('gm'), getCharacterListApi);
router.post('/', permission('admin'), csrf(), create);
router.put('/:id', permission('gm'), csrf(), update);
router.delete('/:id', permission('admin'), remove);

export default router;
