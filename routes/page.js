const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const validator = require('validator');

/* GET pages listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/skill', name: 'Skills'},
        ],
        current: 'Pages'
    };
    try {
        res.locals.csrfToken = req.csrfToken();
        res.locals.pages = await req.models.page.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Pages';
        res.render('page/list', { pageTitle: 'Pages' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const path = req.params.path;
    try{
        const page = await req.models.page.findOne({campaign_id:req.campaign.id, path:path});
        if (!page){
            throw new Error('Invalid Page');
        }
        if (page.show_full_menu){
            res.locals.showFullMenu = true;
        }
        res.locals.csrfToken = req.csrfToken();
        res.locals.page = page;
        res.locals.title += ` - ${page.name}`;
        res.render('page/show');
    } catch(err){
        next(err);
    }
}

async function codeEnter(req, res, next){
    const path = req.params.path;
    try{
        const page = await req.models.page.findOne({campaign_id:req.campaign.id, path:path});
        if (!page){
            throw new Error('Invalid Page');
        }
        const data = req.body.page;
        if (data.code){
            if (_.indexOf(page.codes, data.code) !== -1){
                if (!_.has(req.session, 'pageAccess')){
                    req.session.pageAccess = {};
                }
                req.session.pageAccess[page.id] = true;
            } else {
                req.flash('error', 'Incorrect Code');
            }
        } else {
            req.flash('warning', 'No Code Entered');
        }
        res.redirect(`/page/${page.path}`);

    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        res.locals.page = {
            name: null,
            path:null,
            content: null,
            codes: []
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/page', name: 'Pages'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'pageData')){
            res.locals.page = req.session.pageData;
            delete req.session.pageData;
        }
        res.locals.title += ' - New Page';
        res.render('page/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const page = await req.models.page.get(id);
        if (!page || page.campaign_id !== req.campaign.id){
            throw new Error('Invalid Page');
        }
        res.locals.page = page;
        if (_.has(req.session, 'pageData')){
            res.locals.page = req.session.pageData;
            delete req.session.pageData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/page', name: 'Pages'},
            ],
            current: 'Edit: ' + page.name
        };
        res.locals.title += ` - Edit Page - ${page.name}`;
        res.render('page/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const page = req.body.page;

    req.session.pageData = page;
    for (const field of ['show_full_menu']){
        if (!_.has(page, field)){
            page[field] = false;
        }
    }
    if (!page.codes){
        page.codes = [];
    } else if(!_.isArray(page.codes)){
        page.codes = [page.codes];
    }
    page.campaign_id = req.campaign.id;
    try{
        const id = await req.models.page.create(page);
        await req.audit('page', id, 'create', {new:page});
        delete req.session.pageData;
        req.flash('success', 'Created Page ' + page.name);
        res.redirect('/page');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/page/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const page = req.body.page;
    for (const field of ['show_full_menu']){
        if (!_.has(page, field)){
            page[field] = false;
        }
    }
    if (!page.codes){
        page.codes = [];
    } else if(!_.isArray(page.codes)){
        page.codes = [page.codes];
    }
    console.log(JSON.stringify(page, null, 2));
    req.session.pageData = page;

    try {
        const current = await req.models.page.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.page.update(id, page);
        await req.audit('page', id, 'update', {old: current, new:page});
        delete req.session.pageData;
        req.flash('success', 'Updated Page ' + page.name);
        res.redirect('/page');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/page/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.page.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.page.delete(id);
        await req.audit('page', id, 'delete', {old: current});
        req.flash('success', 'Removed Pages');
        res.redirect('/page');
    } catch(err) {
        return next(err);
    }
}

const router = express.Router();

router.use(function(req, res, next){
    res.locals.siteSection='gm';
    next();
});

router.get('/', csrf(), permission('gm'), list);
router.get('/new', csrf(), permission('gm'), showNew);
router.get('/:path', csrf(), show);
router.get('/:id/edit', csrf(), permission('gm'), showEdit);
router.post('/', csrf(), permission('gm'), create);
router.post('/:path', csrf(), codeEnter);
router.put('/:id', csrf(), permission('gm'), update);
router.delete('/:id', permission('admin'), remove);

module.exports = router;
