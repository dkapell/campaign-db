import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import config from 'config';
import moment from 'moment';
import permission from '../../lib/permission';
import rulebookHelper from '../../lib/rulebookHelper';

/* GET rulebooks listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
        ],
        current: 'Rulebooks'
    };
    try {

        const rulebooks = await req.models.rulebook.find({campaign_id:req.campaign.id}, {excludeFields:['data', 'excludes']});
        res.locals.rulebooks = rulebooks.map( (rulebook) => {
            rulebook.generatedFormated = moment(rulebook.generated).format('lll');
            return rulebook;
        });
        res.locals.csrfToken = req.csrfToken();
        res.locals.title += ' - Rulebooks';
        res.render('admin/rulebook/list', { pageTitle: 'Rulebooks' });
    } catch (err){
        next(err);
    }
}

/*
async function show(req, res, next){
    const id = req.params.id;
    try{
        const rulebook = await req.models.rulebook.get(id);

        if (!rulebook || rulebook.campaign_id !== req.campaign.id){
            throw new Error('Invalid Rulebook');
        }
        rulebook.generatedFormated = moment(rulebook.generated).format('lll');
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/rulebook', name: 'Rulebooks'},
            ],
            current: rulebook.name
        };
        res.locals.title += ` - Rulebook - ${rulebook.name}`;
        res.render('rulebook/show');
    } catch(err){
        next(err);
    }
}
*/

async function showNew(req, res, next){
    try{

        res.locals.rulebook = {
            name: null,
            description: null,
            drive_folder: null,

            excludes: []
        };

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/rulebook', name: 'Rulebooks'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'rulebookData')){
            res.locals.rulebook = req.session.rulebookData;
            delete req.session.rulebookData;
        }
        res.locals.title += ' - New Rulebook';
        res.locals.drive_user = config.get('drive.credentials.client_email');
        res.render('admin/rulebook/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const rulebook = await req.models.rulebook.get(id);
        if (!rulebook || rulebook.campaign_id !== req.campaign.id){
            throw new Error('Invalid Rulebook');
        }
        res.locals.rulebook = rulebook;
        if (_.has(req.session, 'rulebookData')){
            res.locals.rulebook = req.session.rulebookData;
            delete req.session.rulebookData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/rulebook', name: 'Rulebooks'},
            ],
            current: 'Edit: ' + rulebook.name
        };
        res.locals.title += ` - Edit Rulebook - ${rulebook.name}`;
        res.locals.drive_user = config.get('drive.credentials.client_email');
        res.render('admin/rulebook/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const rulebook = req.body.rulebook;

    req.session.rulebookData = rulebook;
    rulebook.campaign_id = req.campaign.id;
    delete rulebook.data;
    delete rulebook.generated;

    try{
        const rulebooks = await req.models.rulebook.find({campaign_id:req.campaign.id});
        const maxVal = _.max(_.pluck(rulebooks, 'display_order'));
        rulebook.display_order = _.isFinite(maxVal)?maxVal + 1:1;

        const id = await req.models.rulebook.create(rulebook);
        await req.audit('rulebook', id, 'create', {new:rulebook});
        delete req.session.rulebookData;
        req.flash('success', 'Created Rulebook ' + rulebook.name);

        await rulebookHelper.generate(id);
        res.redirect('/admin/rulebook');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/admin/rulebook/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const rulebook = req.body.rulebook;
    req.session.rulebookData = rulebook;
    delete rulebook.data;
    delete rulebook.generated;
    if (!_.has(rulebook, 'excludes')){
        rulebook.excludes = [];
    }

    try {
        const current = await req.models.rulebook.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.rulebook.update(id, rulebook);
        await req.audit('rulebook', id, 'update', {old: current, new:rulebook});
        delete req.session.rulebookData;
        await rulebookHelper.generate(id);
        req.flash('success', 'Updated Rulebook ' + rulebook.name);
        res.redirect('/admin/rulebook');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/admin/rulebook/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.rulebook.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.rulebook.delete(id);
        await req.audit('rulebook', id, 'delete', {old: current});
        req.flash('success', 'Removed Rulebook');
        res.redirect('/admin/rulebook');
    } catch(err) {
        return next(err);
    }
}

async function rebuild(req, res){
    const id = req.params.id;
    try {
        const rulebook = await req.models.rulebook.get(id);
        if (!rulebook || rulebook.campaign_id !== req.campaign.id){
            throw new Error('Invalid Rulebook');
        }
        await rulebookHelper.generate(id);
        await req.audit('rulebook', rulebook.id, 'rebuild');
        return res.json({success:true});

    } catch(err) {
        return res.json({success:false, message: err});

    }
}

async function reorder(req, res, next){
    try {
        for (const update of req.body){
            const rulebook = await req.models.rulebook.get(update.id);
            if (!rulebook || rulebook.campaign_id !== req.campaign.id){
                throw new Error ('Invalid record');
            }
            rulebook.display_order = update.display_order;
            await req.models.rulebook.update(update.id, rulebook);
        }
        res.json({success:true});
    }catch (err) {
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
router.put('/order', csrf(), reorder);
router.put('/:id', csrf(), update);
router.put('/:id/rebuild', csrf(), rebuild);
router.delete('/:id', remove);

export default router;
