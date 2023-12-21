'use strict';
var config = require('config');
var _ = require('underscore');
var async = require('async');
var models = require('./models');

module.exports = function(permission, redirect, bypass){
    return function(req, res, next){

        res.locals.checkPermission = function(permission, bypass){
            return check(req, permission, bypass);
        };

        if (!permission){
            return next();
        }

        if (permission === 'login') {
            if (!req.user) {
                return fail(req, res, 'not logged in', redirect);
            } else {
                return next();
            }
        }

        if (!req.user){
            return fail(req, res, 'not logged in', redirect);
        }

        if (check(req, permission, bypass)){
            return next();
        }
        return fail(req, res, 'permission fail', redirect);

    };
};

function fail(req, res, reason, redirect){
    if (reason === 'not logged in'){
        if (req.originalUrl.match(/\/api\//)){
            res.header(`WWW-Authenticate', 'Basic realm="${req.campaign.name}"`);
            res.status(401).send('Authentication required');
        } else {
            if (!req.session.backto &&
                ! req.originalUrl.match(/\/auth\/google/) &&
                ! req.originalUrl.match(/^\/$/) ){
                req.session.backto = req.originalUrl;
            }
            res.redirect('/auth/google');
        }
    } else {
        if (redirect){
            req.flash('error', 'You are not allowed to access that resource');
            res.redirect(redirect);
        } else {
            res.status('403').send('Forbidden');
        }
    }
}

function check(req, permission, bypass){
    var eventId = null;
    const user = req.session.assumed_user ? req.session.assumed_user: req.user;
    //const user = req.user;

    if (!user){
        return false;
    }
    if (permission === 'login'){
        return true;
    }

    if (permission === 'site_admin' && user.site_admin){
        return true;
    }

    switch(permission){
        case 'site_admin':
            if (user.site_admin && (req.session.assumed_user || !user.site_admin )){
                return false;
            }
            break;
        case 'admin':
            if ((req.session.admin_mode || user.type === 'admin' ) && (bypass || (!req.session.gm_mode && !req.session.player_mode))){
                return true;
            }
            break;
        case 'gm':
            if ((req.session.admin_mode || user.type.match(/^(admin|core staff)$/)) && (bypass || !req.session.player_mode)){
                return true;
            }
            break;
        case 'contrib':
            if ((req.session.admin_mode || user.type.match(/^(admin|core staff|contributing staff)$/)) && (bypass || !req.session.player_mode)){
                return true;
            }
            break;
        case 'event':
            if ((req.session.admin_mode || user.type.match(/^(admin|core staff|contributing staff|event staff)$/)) && (bypass || !req.session.player_mode)){
                return true;
            }
            break;
        case 'player':
            if (req.session.admin_mode || user.type !== 'none') {
                return true;
            }
            break;
        default:
            return false;
    }
    return false;
}
