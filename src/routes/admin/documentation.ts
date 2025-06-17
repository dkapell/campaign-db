import express from 'express';
import _ from 'underscore';
import campaignHelper from '../../lib/campaignHelper';
import permission from '../../lib/permission';

/* GET documentations listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
        ],
        current: 'Documentations'
    };
    try {

        res.locals.documentations = await req.models.documentation.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Documentations';
        res.render('admin/documentation/list', { pageTitle: 'Documentations' });
    } catch (err){
        next(err);
    }
}

/*
async function show(req, res, next){
    const id = req.params.id;
    try{
        const documentation = await req.models.documentation.get(id);

        if (!documentation || documentation.campaign_id !== req.campaign.id){
            throw new Error('Invalid Documentation');
        }
        documentation.generatedFormated = moment(documentation.generated).format('lll');
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/documentation', name: 'Documentations'},
            ],
            current: documentation.name
        };
        res.locals.title += ` - Documentation - ${documentation.name}`;
        res.render('documentation/show');
    } catch(err){
        next(err);
    }
}
*/

async function showNew(req, res, next){
    try{

        res.locals.documentation = {
            name: null,
            description: null,
            on_checkin: false,
            valid_from: null,
            staff_only: null
        };

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/documentation', name: 'Documentations'},
            ],
            current: 'New'
        };

        if (_.has(req.session, 'documentationData')){
            res.locals.documentation = req.session.documentationData;
            delete req.session.documentationData;
        }
        res.locals.title += ' - New Documentation';
        res.render('admin/documentation/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    try{
        const documentation = await req.models.documentation.get(id);
        if (!documentation || documentation.campaign_id !== req.campaign.id){
            throw new Error('Invalid Documentation');
        }
        if (documentation.valid_from){
            const valid_dates = await campaignHelper.splitTime(req.campaign.id, documentation.valid_from);
            documentation.valid_from_date = valid_dates.date;
        }
        res.locals.documentation = documentation;
        if (_.has(req.session, 'documentationData')){
            res.locals.documentation = req.session.documentationData;
            delete req.session.documentationData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/documentation', name: 'Documentations'},
            ],
            current: 'Edit: ' + documentation.name
        };
        res.locals.title += ` - Edit Documentation - ${documentation.name}`;
        res.render('admin/documentation/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const documentation = req.body.documentation;

    req.session.documentationData = documentation;
    documentation.campaign_id = req.campaign.id;

    try{

        const documentations = await req.models.documentation.find({campaign_id:req.campaign.id});
        const maxVal = _.max(_.pluck(documentations, 'display_order'));
        documentation.display_order = _.isFinite(maxVal)?maxVal + 1:1;

        for (const field of ['on_checkin', 'staff_only']){
            if (!_.has(documentation, field)){
                documentation[field] = false;
            }
        }
        if (documentation.valid_from_date){
            documentation.valid_from = await campaignHelper.parseTime(req.campaign.id, documentation.valid_from_date, 0);
        }
        const id = await req.models.documentation.create(documentation);
        await req.audit('documentation', id, 'create', {new:documentation});
        delete req.session.documentationData;
        req.flash('success', 'Created Documentation ' + documentation.name);

        res.redirect('/admin/documentation');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/admin/documentation/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const documentation = req.body.documentation;
    req.session.documentationData = documentation;
    delete documentation.data;
    delete documentation.generated;
    if (!_.has(documentation, 'excludes')){
        documentation.excludes = [];
    }

    try {
        const current = await req.models.documentation.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        for (const field of ['on_checkin', 'staff_only']){
            if (!_.has(documentation, field)){
                documentation[field] = false;
            }
        }
        if (documentation.valid_from_date){
            documentation.valid_from = await campaignHelper.parseTime(req.campaign.id, documentation.valid_from_date, 0);
        }
        await req.models.documentation.update(id, documentation);
        await req.audit('documentation', id, 'update', {old: current, new:documentation});
        delete req.session.documentationData;
        req.flash('success', 'Updated Documentation ' + documentation.name);
        res.redirect('/admin/documentation');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/admin/documentation/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.documentation.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.documentation.delete(id);
        await req.audit('documentation', id, 'delete', {old: current});
        req.flash('success', 'Removed Documentation');
        res.redirect('/admin/documentation');
    } catch(err) {
        return next(err);
    }
}

async function reorder(req, res, next){
    try {
        for (const update of req.body){
            const documentation = await req.models.documentation.get(update.id);
            if (!documentation || documentation.campaign_id !== req.campaign.id){
                throw new Error ('Invalid record');
            }
            documentation.display_order = update.display_order;
            await req.models.documentation.update(update.id, documentation);
        }
        res.json({success:true});
    } catch (err) {
        return next(err);
    }
}

const router = express.Router();

router.use(permission('admin'));
router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.get('/', list);
router.get('/new', showNew);
router.get('/:id', showEdit);
router.get('/:id/edit', showEdit);
router.post('/', create);
router.put('/order', reorder);
router.put('/:id', update);
router.delete('/:id', remove);

export default router;
