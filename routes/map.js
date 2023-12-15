const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const validator = require('validator');

function showMap(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Map'
    };
    res.locals.title += ' - Map';
    res.render('map/show');
}

const router = express.Router();

router.use(permission());
router.use(function(req, res, next){
    res.locals.siteSection='worldbuilding';
    next();
});

router.get('/', showMap);

module.exports = router;
