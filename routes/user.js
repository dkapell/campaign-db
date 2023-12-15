const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET users listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Users'
    };
    try {
        res.locals.users = await req.models.user.list();
        res.locals.title += ' - Users';
        res.render('user/list', { pageTitle: 'Users' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();
    try{

        const user = await req.models.user.get(id);
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

        const characters = await req.models.character.find({user_id: user.id});
        for (const character of characters){
            character.user = user;
        }
        res.locals.characters = characters;
        res.locals.user = user;
        res.locals.title += ` - Users - ${user.name}`;
        res.render('user/show');
    } catch(err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.user = {
        name: null,
        email: null,
        user_type: 'none',
        drive_folder: null,
        staff_drive_folder: null
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
        const user = await req.models.user.get(id);
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

async function create(req, res, next){
    const user = req.body.user;

    req.session.userData = user;

    try{
        await req.models.user.create(user);
        delete req.session.userData;
        req.flash('success', 'Created User ' + user.name);
        res.redirect('/user');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/user/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const user = req.body.user;
    req.session.userData = user;

    try {
        const current = await req.models.user.get(id);

        const currentUser = req.session.assumed_user ? req.session.assumed_user: req.user;

        if (currentUser.user_type !== 'admin'){
            delete user.name;
            delete user.email;
            delete user.user_type;
        }

        await req.models.user.update(id, user);
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
        await req.models.user.delete(id);
        req.flash('success', 'Removed User');
        res.redirect('/user');
    } catch(err) {
        return next(err);
    }
}

async function assume(req, res, next){
    try{
        const user = await req.models.user.get(req.params.id);
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

function revert(req, res, next){
    delete req.session.assumed_user;
    res.redirect('/');
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
router.post('/', permission('admin'), csrf(), create);
router.put('/:id', permission('gm'), csrf(), update);
router.delete('/:id', permission('admin'), remove);

module.exports = router;
