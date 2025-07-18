import config from 'config';
import express from 'express';
import passport from 'passport';
import _ from 'underscore';

import permission from '../lib/permission';

const router = express.Router();


// GET /auth/google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve
//   redirecting the user to google.com.  After authorization, Google
//   will redirect the user back to this application at /auth/google/callback
router.get('/google',
    (req, res, next) => {
        const authConfig = {
            callbackURL: getCallbackUrl(req, 'google'),
            scope: [ 'email', 'profile' ]
        };

        if (req.campaign.google_client_id && req.campaign.google_client_secret){
            passport.authenticate(`google-campaign-${req.campaign.id}`, authConfig)(req, res, next);
        } else {
            passport.authenticate('google', authConfig)(req, res, next);
        }
    });

// GET /auth/google/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
router.get('/google/callback',
    (req, res, next) => {
        if (_.has(req.session, 'backto') && req.session.backto){
            res.locals._backto = req.session.backto;
        }
        const authConfig = {
            failureRedirect: '/',
            callbackURL: getCallbackUrl(req, 'google'),
        };
        if (req.campaign.google_client_id && req.campaign.google_client_secret){
            passport.authenticate(`google-campaign-${req.campaign.id}`, authConfig)(req, res, next);
        } else {
            passport.authenticate('google', authConfig)(req, res, next);
        }
    },
    (_req, res) => {
        if (_.has(res.locals, '_backto') ){
            const backto = res.locals._backto;
            delete res.locals._backto;

            res.redirect(backto);
        } else {
            res.redirect('/');
        }
    });

router.get('/logout',
    function logout(req, res, next){
        req.logout(err => {
            if(err) return next(err);
            res.redirect('/');
        });
    });

router.get('/admin', function toggleAdminMode(req, res){
        if (req.session.admin_mode){
            delete req.session.admin_mode;
        } else if (req.checkPermission('site_admin')){
            req.session.admin_mode = true;
        }
        res.redirect('/');
    });

router.get('/gm',
    function toggleGmMode(req, res){
        if (req.session.gm_mode){
            delete req.session.gm_mode;
        } else if (req.checkPermission('admin')){
            req.session.gm_mode = true;
        }
        res.redirect('/');
    });

router.get('/player', permission('player'),
    function togglePlayerMode(req, res){
        if (req.session.player_mode){
            delete req.session.player_mode;
            req.session.activeUser.type = req.user.type;
        } else if (req.checkPermission('gm')){
            req.session.player_mode = true;
            req.session.activeUser.type = 'player';
        }
        res.redirect('/');
    });

function getCallbackUrl(req, type){
    let proto = 'http';
    if (req.headers['x-forwarded-proto'] === 'https'){
        proto = 'https';
    }
    if (config.get('auth.httpsAlways')){
        proto = 'https';
    }

    return `${proto}://${req.headers.host}/auth/${type}/callback`;
}

export default router;
