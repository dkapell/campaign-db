import express from 'express';
import csrf from 'csurf';
import async from 'async';
import _ from 'underscore';
import permission from '../../lib/permission';
import campaignHelper from '../../lib/campaignHelper';
import surveyHelper from '../../lib/surveyHelper';
import uploadHelper from '../../lib/uploadHelper';
import Character from '../../lib/Character';

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
                user.documentations = await req.models.documentation_user.find({campaign_id:req.campaign.id, user_id:user.id});
                user.image = await campaignHelper.getUserImage(req.campaign.id, user.id);
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
        user.image = await campaignHelper.getUserImage(req.campaign.id, user.id);
        res.locals.documentations = await req.models.documentation_user.find({campaign_id:req.campaign.id, user_id:user.id});
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
        permissions: [],
        documentations: [],
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
        user.documentations = await campaignHelper.getDocumentations(req.campaign.id, id);
        user.image = await campaignHelper.getUserImage(req.campaign.id, user.id);
        res.locals.user = user;
        if (_.has(req.session, 'userData')){
            res.locals.user = req.session.userData;
            res.locals.user.name = res.locals.user.campaign_user_name;
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

async function showEditProfile(req, res, next){
    res.locals.csrfToken = req.csrfToken();

    try {
        const user = await req.models.user.get(req.campaign.id, req.session.activeUser.id);
        user.image = await campaignHelper.getUserImage(req.campaign.id, user.id);
        res.locals.user = user;
        if (_.has(req.session, 'userProfileData')){
            res.locals.user = req.session.userProfileData;
            res.locals.user.name = res.locals.user.campaign_user_name;
            delete req.session.userProfileData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/user/profile', name: 'Profile'},
            ],
            current: `Edit My ${req.campaign.name} Profile`
        };
        res.locals.title += ` - Edit Profile`;
        res.render('user/profileEdit');

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

        if (req.campaign.documentations){
            user.documentations = await parseDocumentations(req, user.documentations, res.locals.checkPermission('gm'));
        }


        if ( user.image_id ===''){
            user.image_id = null;
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

        if (!user.permissions){
            user.permissions = [];
        } else if(!_.isArray(user.permissions)){
            user.permissions = [user.permissions];
        }

        if (! (currentUser.type === 'admin' || current.site_admin)){
            delete user.name;
            delete user.email;
            delete user.type;
            delete user.permissions;
        }

        if (req.campaign.documentations){
            user.documentations = await parseDocumentations(req, user.documentations, res.locals.checkPermission('gm'));
        }

        if ( user.image_id ===''){
            user.image_id = null;
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

async function updateProfile(req, res){
    const user = req.body.user;
    req.session.userProfileData = user;
    try {
        const current = await req.models.user.get(req.campaign.id, req.session.activeUser.id);

        if ( user.image_id ===''){
            user.image_id = null;
        }

        current.user_id = user.image_id

        const updateDoc = {
            image_id:user.image_id
        };

        await req.models.user.update(req.campaign.id, current.id, updateDoc);
        delete req.session.userProfileData;
        req.flash('success', 'Updated Profile for ' + current.name);
        res.redirect('/');

    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/user/profile`));
    }
}

async function parseDocumentations(req, documentations = [], isGm){
    const output = [];
    for (const documentation of req.campaign.documentations){
        if (documentation.staff_only && !isGm){
            continue;
        }
        const userDoc = _.findWhere(documentations, {id: ''+documentation.id});
        const doc = {
            campaign_id: req.campaign.id,
            documentation_id: documentation.id,
            valid_date:null
        };

        if (documentation.valid_from){
            doc.valid_date = userDoc.valid_date_date?await campaignHelper.parseTime(req.campaign.id, userDoc.valid_date_date, 0):false;
        } else {
            doc.valid_date = userDoc.valid?new Date():false;

        }
        output.push(doc);
    }
    return output;
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


async function signS3UserImage(req, res, next){

    const fileName = decodeURIComponent(req.query.filename);
    const fileType = decodeURIComponent(req.query.filetype);

    if (!fileType.match(/^image/)){
        return res.json({success:false, error: 'invalid file type'});
    }
    const permissionLevel = req.campaign.player_gallery?'player':'event';
    const upload = await req.upload.makeEmptyUpload(fileName, 'image', false, permissionLevel);

    const image = {
        id: null,
        upload_id: upload.id,
        campaign_id: req.campaign.id,
        upload: upload,
        for_cms: false

    };

    image.id = await req.models.image.create(image);
    const key = uploadHelper.getKey(image.upload);
    try{
        const signedRequest = await uploadHelper.signS3(key, fileType, upload.is_public);
        res.json({
            success:true,
            data: {
                signedRequest: signedRequest,
                url: uploadHelper.getUrl(image.upload),
                objectId: image.id,
                postUpload: `/admin/upload/${image.upload.id}/uploaded`
            },
        });
    }
    catch (err) {
        return next(err);
    }
}

async function gallery(req, res, next){
    if (!req.campaign.player_gallery && !res.locals.checkPermission('event')){
        req.flash('warning', `Gallery is not available to ${req.campaign.user_type_map['player'].name}s` );
        return res.redirect('/');
    }
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Gallery'
    };
    try {
        const campaign_users = await req.models.campaign_user.find({campaign_id:req.campaign.id});
        const users = await async.map(campaign_users, async (campaign_user) => {
            const user = await req.models.user.get(req.campaign.id, campaign_user.user_id);
            user.image = await campaignHelper.getUserImage(req.campaign.id, user.id);
            if (user.type === 'player'){
                const characterData = await req.models.character.findOne({user_id: user.id, active: true, campaign_id:req.campaign.id});
                if (characterData){
                    const character = new Character({id:characterData.id});
                    await character.init();
                    user.character = await character.data();
                }
            }
            return user;
        });
        res.locals.users = users.sort(campaignHelper.userSorter);
        res.render('user/gallery', { pageTitle: 'Gallery' });
    } catch (err){
        next(err);
    }
}

const router = express.Router();

router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.get('/', permission('gm, documentation edit'), list);
router.get('/gallery', permission('player'), gallery);
router.get('/new', permission('admin'), csrf(), showNew);
router.get('/revert', revert);
router.get('/sign-s3', csrf(), signS3UserImage);
router.get('/profile', permission('player'), csrf(), showEditProfile);
router.get('/:id', permission('gm, documentation edit'), csrf(), show);
router.get('/:id/edit', permission('gm, documentation edit'), csrf(), showEdit);
router.get('/:id/assume', permission('gm'), assume);
router.get('/:id/characters', permission('gm'), getCharacterListApi);
router.post('/', permission('admin'), csrf(), create);
router.put('/profile', permission('player'), csrf(), updateProfile);
router.put('/:id', permission('gm, documentation edit'), csrf(), update);
router.delete('/:id', permission('admin'), remove);

export default router;
