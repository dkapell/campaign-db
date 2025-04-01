'use strict';
import _ from 'underscore';
import config from 'config';

function permission(permission?:string, redirect?:string, bypass?:boolean){
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

function fail(req, res, reason:string, redirect?:string){
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

function check(req: Express.Request, permissionList:string, bypass?:boolean){
    const user = req.session.assumed_user ? req.session.assumed_user: req.user as CampaignUser;

    if (!user){
        return false;
    }
    if (permissionList === 'login'){
        return true;
    }

    if (permissionList === 'site_admin' && user.site_admin){
        return true;
    }

    const permissionListParts = permissionList.split(/\s*,\s*/);

    for (const permission of permissionListParts){
        const result = validatePermission(req, permission, user, bypass)
        if (result) { return true }
    }
    return false;
}

function validatePermission(req, permission, user, bypass){
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
        default:{
            const permissionList = config.get("permissions") as string[];
            if (_.indexOf(permissionList, permission) !== -1 && _.indexOf(user.permissions, permission) !== -1){
                return true;
            }

            return false;
        }
    }
}
export default permission;
