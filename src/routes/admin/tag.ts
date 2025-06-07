import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import permission from '../../lib/permission';

/* GET tags listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
        ],
        current: 'Tags'
    };
    try {

        res.locals.tags = await req.models.tag.find({campaign_id:req.campaign.id});
        res.locals.csrfToken = req.csrfToken();
        res.locals.title += ' - Tags';
        res.render('admin/tag/list', { pageTitle: 'Tags' });
    } catch (err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{

        res.locals.tag = {
            name: null,
            type: null,
        };

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/tag', name: 'Tags'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'tagData')){
            res.locals.tag = req.session.tagData;
            delete req.session.tagData;
        }
        res.locals.title += ' - New Tag';
        res.render('admin/tag/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const tag = await req.models.tag.get(id);
        if (!tag || tag.campaign_id !== req.campaign.id){
            throw new Error('Invalid Tag');
        }
        res.locals.tag = tag;
        if (_.has(req.session, 'tagData')){
            res.locals.tag = req.session.tagData;
            delete req.session.tagData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/tag', name: 'Tags'},
            ],
            current: 'Edit: ' + tag.name
        };
        res.locals.title += ` - Edit Tag - ${tag.name}`;
        res.render('admin/tag/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const tag = req.body.tag;

    req.session.tagData = tag;
    tag.campaign_id = req.campaign.id;

    try{    
        const id = await req.models.tag.create(tag);
        await req.audit('tag', id, 'create', {new:tag});
        delete req.session.tagData;
        req.flash('success', 'Created Tag ' + tag.name);
        res.redirect('/admin/tag');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/admin/tag/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const tag = req.body.tag;
    req.session.tagData = tag;

    try {
        const current = await req.models.tag.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        tag.campaign_id = req.campaign.id;
        await req.models.tag.update(id, tag);
        await req.audit('tag', id, 'update', {old: current, new:tag});
        delete req.session.tagData;
        req.flash('success', 'Updated Tag ' + tag.name);
        res.redirect('/admin/tag');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/admin/tag/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.tag.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.tag.delete(id);
        await req.audit('tag', id, 'delete', {old: current});
        req.flash('success', 'Removed Tag');
        res.redirect('/admin/tag');
    } catch(err) {
        return next(err);
    }
}

const router = express.Router();

router.use(permission('admin'));
router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.get('/', csrf(), list);
router.get('/new', csrf(), showNew);
router.get('/:id', csrf(), showEdit);
router.get('/:id/edit', csrf(),showEdit);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.delete('/:id', remove);

export default router;
