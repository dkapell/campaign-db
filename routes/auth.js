const config = require('config');
const express = require('express');
const passport = require('passport');
const _ = require('underscore');

const permission = require('../lib/permission');

const router = express.Router();

// GET /auth/google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve
//   redirecting the user to google.com.  After authorization, Google
//   will redirect the user back to this application at /auth/google/callback
router.get('/google',
    passport.authenticate('google', { scope: [ 'email', 'profile' ]  }));

// GET /auth/google/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    function(req, res) {
        if (_.has(req.session, 'backto')){
            const backto = req.session.backto;
            delete req.session.backto;
            res.redirect(backto);
        } else {
            res.redirect('/');
        }
    });

router.get('/logout',
    function logout(req, res, next){
        req.logout();
        delete req.session.accessToken;
        res.redirect('/');
    });

router.get('/gm', permission('gm'),
    function toggleGmMode(req, res, next){
        if (req.session.gm_mode){
            delete req.session.gm_mode;
        } else {
            req.session.gm_mode = true;
        }
        res.redirect('/');
    });

router.get('/player', permission('player'),
    function togglePlayerMode(req, res, next){
        if (req.session.player_mode){
            delete req.session.player_mode;
        } else {
            req.session.player_mode = true;
        }
        res.redirect('/');
    });


module.exports = router;
