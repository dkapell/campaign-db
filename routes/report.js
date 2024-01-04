const express = require('express');
const csrf = require('csurf');
const config = require('config');
const _ = require('underscore');
const async = require('async');
const createError = require('http-errors');
const permission = require('../lib/permission');
const reportHelper = require('../lib/reportHelper');

function list (req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'}
        ],
        current: 'Reports'
    };
    try {
        res.locals.csrfToken = req.csrfToken();
        res.render('report/list', { pageTitle: 'Reports' });
    } catch (err){
        next(err);
    }
}

async function showGroupReport(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/report', name: 'Reports'},
        ],
        current: 'Character Group Report'
    };
    try{
        const characters = await req.models.character.find({active:true, campaign_id: req.campaign.id});
        res.locals.characters = await async.map(characters, async (character) => {
            if (character.user_id){
                character.user = await req.models.user.get(req.campaign.id, Number(character.user_id));
            }
            return character;
        });
        res.locals.csrfToken = req.csrfToken();
        res.render('report/group', { pageTitle: 'Character Group Report' });
    } catch (err){
        next(err);
    }

}

async function getGroupReportData(req, res, next){
    try{
        if (!req.query.characters){
            return  res.json(await reportHelper.data([], req.campaign.id));
        }
        const characterIds = req.query.characters.split(/\s*,\s*/);

        res.json(await reportHelper.data(characterIds, req.campaign.id));
    } catch(err){
        next(err);
    }
}

const router = express.Router();

router.use(permission('contrib'));
router.use(function(req, res, next){
    res.locals.siteSection='gm';
    next();
});

router.get('/',csrf(), list);
router.get('/group', csrf(), showGroupReport);
router.get('/group/data', csrf(), getGroupReportData);
module.exports = router;
