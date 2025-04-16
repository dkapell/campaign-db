import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import permission from '../../lib/permission';

/* GET attributes listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/skill', name: 'Skills'},
        ],
        current: 'Attributes'
    };
    try {
        res.locals.csrfToken = req.csrfToken();
        res.locals.attributes = await req.models.attribute.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Attributes';
        res.render('attribute/list', { pageTitle: 'Attributes' });
    } catch (err){
        next(err);
    }
}
/*
async function show(req, res, next){
    const id = req.params.id;
    try{
        const attribute = await req.models.attribute.get(id);
        if (!attribute || attribute.campaign_id !== req.campaign.id){
            throw new Error('Invalid Attribute');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/attribute', name: 'Attributes'},
            ],
            current: attribute.attribute
        };
        res.locals.skills = await req.models.skill.find({source_id:id});
        res.locals.title += ` - Attribute - ${attribute.name}`;
        res.render('attribute/show');
    } catch(err){
        next(err);
    }
}
*/

async function showNew(req, res, next){
    try{
        res.locals.attribute = {
            name: null,
            description: null,
            display_name: true,
            initial: 0,
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skills', name: 'Skills'},
                { url: '/attribute', name: 'Attributes'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'attributeData')){
            res.locals.attribute = req.session.attributeData;
            delete req.session.attributeData;
        }
        res.locals.title += ' - New Attribute';
        res.render('attribute/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const attribute = await req.models.attribute.get(id);
        if (!attribute || attribute.campaign_id !== req.campaign.id){
            throw new Error('Invalid Attribute');
        }
        res.locals.attribute = attribute;
        if (_.has(req.session, 'attributeData')){
            res.locals.attribute = req.session.attributeData;
            delete req.session.attributeData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/attribute', name: 'Attributes'},
            ],
            current: 'Edit: ' + attribute.name
        };
        res.locals.title += ` - Edit Attribute - ${attribute.name}`;
        res.render('attribute/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const attribute = req.body.attribute;

    req.session.attributeData = attribute;
    for (const field of ['toughness', 'calculated']){
        if (!_.has(attribute, field)){
            attribute[field] = false;
        }
    }
    attribute.campaign_id = req.campaign.id;
    try{
        const attributes = await req.models.attribute.find({campaign_id:req.campaign.id});
        const maxVal = _.max(_.pluck(attributes, 'display_order'));
        attribute.display_order = _.isFinite(maxVal)?maxVal + 1:1;

        const id = await req.models.attribute.create(attribute);
        await req.audit('attribute', id, 'create', {new:attribute});
        delete req.session.attributeData;
        req.flash('success', 'Created Attribute ' + attribute.name);
        res.redirect('/attribute');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/attribute/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const attribute = req.body.attribute;
    req.session.attributeData = attribute;
    for (const field of ['toughness', 'calculated']){
        if (!_.has(attribute, field)){
            attribute[field] = false;
        }
    }

    try {
        const current = await req.models.attribute.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.attribute.update(id, attribute);
        await req.audit('attribute', id, 'update', {old: current, new:attribute});
        delete req.session.attributeData;
        req.flash('success', 'Updated Attribute ' + attribute.name);
        res.redirect('/attribute');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/attribute/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.attribute.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.attribute.delete(id);
        await req.audit('attribute', id, 'delete', {old: current});
        req.flash('success', 'Removed Attributes');
        res.redirect('/attribute');
    } catch(err) {
        return next(err);
    }
}

async function reorder(req, res, next){
    try {
        for (const update of req.body){
            const attribute = await req.models.attribute.get(update.id);
            if (!attribute || attribute.campaign_id !== req.campaign.id){
                throw new Error ('Invalid record');
            }
            attribute.display_order = update.display_order;
            await req.models.attribute.update(update.id, attribute);
        }
        res.json({success:true});
    }catch (err) {
        return next(err);
    }
}

const router = express.Router();

router.use(permission('gm'));
router.use(function(req, res, next){
    res.locals.siteSection='gm';
    next();
});

router.get('/', csrf(), list);
router.get('/new', csrf(), showNew);
router.get('/:id', csrf(), showEdit);
router.get('/:id/edit', csrf(),showEdit);
router.post('/', csrf(), create);
router.put('/order', csrf(), reorder);
router.put('/:id', csrf(), update);
router.delete('/:id', permission('admin'), remove);

export default router;
