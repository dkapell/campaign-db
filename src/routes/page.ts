import express from 'express';
import _ from 'underscore';
import permission from '../lib/permission';

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
        res.locals.pages = await req.models.page.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Pages';
        res.render('page/list', { pageTitle: 'Pages' });
    } catch (err){
        next(err);
    }
}

async function checkPagePermission(req, res, next){
    const path = req.params.path;
    try{
        const page = await req.models.page.findOne({campaign_id:req.campaign.id, path:path});
        if (!page){
            throw new Error('Invalid Page');
        }

        if (page.permission && page.permission !== 'any'){
            return (permission(page.permission, '/'))(req, res, next);
        }
        next();
    } catch(err){
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
        if (page.menu){
            res.locals.siteSection=page.menu;
        }
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
            permission:'any',
            codes: []
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/page', name: 'Pages'},
            ],
            current: 'New'
        };

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

async function create(req, res){
    const page = req.body.page;

    req.session.pageData = page;
    for (const field of ['show_full_menu']){
        if (!_.has(page, field)){
            page[field] = false;
        }
    }
    if (page.menu === 'none'){
        page.menu = null
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

async function update(req, res){
    const id = req.params.id;
    const page = req.body.page;
    for (const field of ['show_full_menu']){
        if (!_.has(page, field)){
            page[field] = false;
        }
    }
    if (page.menu === 'none'){
        page.menu = null
    }

    if (!page.codes){
        page.codes = [];
    } else if(!_.isArray(page.codes)){
        page.codes = [page.codes];
    }
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
    res.locals.siteSection='admin';
    next();
});


router.get('/', permission('gm'), list);
router.get('/new', permission('gm'), showNew);
router.get('/:id/edit', permission('gm'), showEdit);
router.get('/:path(*)', checkPagePermission, show);
router.post('/', permission('gm'), create);
router.post('/:path(*)', codeEnter);
router.put('/:id', permission('gm'), update);
router.delete('/:id', permission('admin'), remove);

export default router;
