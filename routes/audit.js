const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const moment = require('moment');
const permission = require('../lib/permission');
const validator = require('validator');
const async = require('async');
const skillHelper = require('../lib/skillHelper');

/* GET audits listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Audits'
    };
    res.render('audit/list', { pageTitle: 'Audits' });
}

async function listSkillAudits(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/skil', name: 'Skills'},

        ],
        current: 'Audits'
    };
    res.render('audit/listSkills', { pageTitle: 'Skill Changes' });
}


async function query(req, res, next){
    const options = {};
    if (_.has(req.query, 'start')){
        options.offset = req.query.start;
    }
    if (_.has(req.query, 'length')){
        options.limit = req.query.length;
    }
    if (_.has(req.query, 'order')){
        options.order = [];

        for (const order of req.query.order){
            let orderStr = '';
            switch (Number(order.column)){
                case 0: orderStr = 'created'; break;
                case 1: orderStr = 'user_id'; break;
                case 2: orderStr = 'action'; break;
                case 3: orderStr = 'object_type'; break;
                default: orderStr = 'created'; break;
            }
            orderStr += ` ${order.dir}`;
            options.order.push(orderStr);
        }
    }
    console.log(options);

    const response = {
        draw: Number(req.query.draw)
    };


    try {
        let audits = [];
        /*
        if (req.query.search && req.query.search.value){
            audits = await req.models.audit.search(req.query.search.value, options);
            response.recordsFiltered = await req.models.audit.searchCount(req.query.search.value);
        } else {
        */
        audits = await req.models.audit.find({}, options);
        response.recordsFiltered = await req.models.audit.count();
        // }
        response.data = await async.map(audits, async (audit) => {
            audit.createdFormated = moment(audit.created).format('lll');
            if (audit.object_type === 'skill'){
                audit.diff = await skillHelper.diff(audit.data.old, audit.data.new);
            }
            return audit;
        });
        response.recordsTotal = await req.models.audit.count();

        res.json(response);
    } catch (err) {
        response.error = err.toString();
        console.log(err);
        res.json(response);
        //next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const audit = await req.models.audit.get(id);
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/audit', name: 'Audits'},
            ],
            current: 'Audit'
        };
        res.render('audit/show');
    } catch(err){
        next(err);
    }
}

const router = express.Router();

router.use(permission('gm'));
router.use(function(req, res, next){
    res.locals.siteSection='admin';
    res.locals.title += ' - Audits';
    next();
});

router.get('/', list);
router.get('/skill', listSkillAudits);
router.get('/query', query);
router.get('/:id', csrf(), show);


module.exports = router;
