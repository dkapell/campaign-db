import express from 'express';
import _ from 'underscore';
import config from 'config';
import permission from '../../lib/permission';

/* GET schedule_reports listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
        ],
        current: 'Schedule Reports'
    };
    try {

        res.locals.schedule_reports = await req.models.schedule_report.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Schedule Reports';
        res.render('admin/schedule_report/list', { pageTitle: 'Schedule Reports' });
    } catch (err){
        next(err);
    }
}

/*
async function show(req, res, next){
    const id = req.params.id;
    try{
        const schedule_report = await req.models.schedule_report.get(id);

        if (!schedule_report || schedule_report.campaign_id !== req.campaign.id){
            throw new Error('Invalid Rulebook');
        }
        schedule_report.generatedFormated = moment(schedule_report.generated).format('lll');
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/schedule_report', name: 'Rulebooks'},
            ],
            current: schedule_report.name
        };
        res.locals.title += ` - Rulebook - ${schedule_report.name}`;
        res.render('schedule_report/show');
    } catch(err){
        next(err);
    }
}
*/

async function showNew(req, res, next){
    try{

        res.locals.schedule_report = {
            name: null,
            config: {},
        };

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/schedule_report', name: 'Schedule Reports'},
            ],
            current: 'New'
        };

        if (_.has(req.session, 'schedule_reportData')){
            res.locals.schedule_report = req.session.schedule_reportData;
            delete req.session.schedule_reportData;
        }
        res.locals.reports = _.keys(config.get('scheduleReports'));
        res.locals.title += ' - New Schedule Report';
        res.render('admin/schedule_report/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;

    try{
        const schedule_report = await req.models.schedule_report.get(id);
        if (!schedule_report || schedule_report.campaign_id !== req.campaign.id){
            throw new Error('Invalid Schedule Report');
        }
        res.locals.schedule_report = schedule_report;
        if (_.has(req.session, 'schedule_reportData')){
            res.locals.schedule_report = req.session.schedule_reportData;
            delete req.session.schedule_reportData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: `/admin/campaign/${req.campaign.id}`, name: 'Campaign'},
                { url: '/admin/schedule_report', name: 'Schedule Reports'},
            ],
            current: `Edit: ${schedule_report.name}`
        };
        res.locals.title += ` - Edit Schedule Report - ${schedule_report.name}`;
        res.render('admin/schedule_report/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const schedule_report = req.body.schedule_report;

    req.session.schedule_reportData = schedule_report;
    schedule_report.campaign_id = req.campaign.id;

    try{
        const reports = config.get('scheduleReports');
        if (!_.has(reports, schedule_report.name)){
            throw new Error('Invalid Report Type');
        }
        schedule_report.config = reports[schedule_report.name];
        const id = await req.models.schedule_report.create(schedule_report);
        await req.audit('schedule_report', id, 'create', {new:schedule_report});
        delete req.session.schedule_reportData;
        req.flash('success', `Created Schedule Report`);
        res.redirect('/admin/schedule_report');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/admin/schedule_report/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const schedule_report = req.body.schedule_report;
    req.session.schedule_reportData = schedule_report;

    try {
        const current = await req.models.schedule_report.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        schedule_report.name = current.name;

        await req.models.schedule_report.update(id, schedule_report);
        await req.audit('schedule_report', id, 'update', {old: current, new:schedule_report});
        delete req.session.schedule_reportData;
        req.flash('success', `Updated Schedule Report: ${schedule_report.name}`);
        res.redirect('/admin/schedule_report');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/admin/schedule_report/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.schedule_report.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.schedule_report.delete(id);
        await req.audit('schedule_report', id, 'delete', {old: current});
        req.flash('success', 'Removed Schedule Report');
        res.redirect('/admin/schedule_report');
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

router.get('/', list);
router.get('/new', showNew);
router.get('/:id', showEdit);
router.get('/:id/edit', showEdit);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

export default router;
