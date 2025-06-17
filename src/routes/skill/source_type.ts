import express from 'express';
import _ from 'underscore';
import permission from '../../lib/permission';

/* GET skill_source_types listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/skill', name: 'Skills'},
        ],
        current: 'Source Types'
    };
    try {
        res.locals.skill_source_types = await req.models.skill_source_type.find({campaign_id: req.campaign.id});
        res.locals.title += ' - Skill Source Types';
        res.render('skill_source_type/list', { pageTitle: 'Skill Source Types' });
    } catch (err){
        next(err);
    }
}

/*
async function show(req, res, next){
    const id = req.params.id;
    try{
        const skill_source_type = await req.models.skill_source_type.get(id);
        if (!skill_source_type || skill_source_type.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Source Type');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_source_type', name: 'Source Types'},
            ],
            current: skill_source_type.skill_source_type
        };
        res.locals.title += ` - Skill Source Type - ${skill_source_type.name}`;
        res.render('skill_source_type/show');
    } catch(err){
        next(err);
    }
}
*/

async function showNew(req, res, next){
    try{


        res.locals.skill_source_type = {
            name: null,
            num_free: 0,
            display_on_sheet: true,
            display_in_header: false
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_source_type', name: 'Source Types'},
            ],
            current: 'New'
        };

        if (_.has(req.session, 'skill_source_typeData')){
            res.locals.skill_source_type = req.session.skill_source_typeData;
            delete req.session.skill_source_typeData;
        }
        res.locals.title += ' - New Skill Source Type';
        res.render('skill_source_type/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;

    try{
        const skill_source_type = await req.models.skill_source_type.get(id);
        if (!skill_source_type || skill_source_type.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Source Type');
        }
        res.locals.skill_source_type = skill_source_type;
        if (_.has(req.session, 'skill_source_typeData')){
            res.locals.skill_source_type = req.session.skill_source_typeData;
            delete req.session.skill_source_typeData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_source_type', name: 'Source Types'},
            ],
            current: 'Edit: ' + skill_source_type.name
        };
        res.locals.title += ` - Edit Skill Source Type - ${skill_source_type.name}`;
        res.render('skill_source_type/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const skill_source_type = req.body.skill_source_type;

    req.session.skill_source_typeData = skill_source_type;
    skill_source_type.campaign_id = req.campaign.id;

    for (const field of ['display_in_header', 'display_on_sheet']){
        if (!_.has(skill_source_type, field)){
            skill_source_type[field] = false;
        }
    }

    try{
        const source_types = await req.models.skill_source_type.find({campaign_id:req.campaign.id});
        const maxVal = _.max(_.pluck(source_types, 'display_order'));
        skill_source_type.display_order = _.isFinite(maxVal)?maxVal + 1:1;

        const id = await req.models.skill_source_type.create(skill_source_type);
        await req.audit('skill_source_type', id, 'create', {new:skill_source_type});
        delete req.session.skill_source_typeData;
        req.flash('success', 'Created Source Type ' + skill_source_type.name);
        res.redirect('/skill_source_type');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/skill_source_type/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const skill_source_type = req.body.skill_source_type;
    req.session.skill_source_typeData = skill_source_type;

    for (const field of ['display_in_header', 'display_on_sheet']){
        if (!_.has(skill_source_type, field)){
            skill_source_type[field] = false;
        }
    }

    try {
        const current = await req.models.skill_source_type.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.skill_source_type.update(id, skill_source_type);
        await req.audit('skill_source_type', id, 'update', {old: current, new:skill_source_type});
        delete req.session.skill_source_typeData;
        req.flash('success', 'Updated Source Type ' + skill_source_type.name);
        res.redirect('/skill_source_type');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/skill_source_type/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.skill_source_type.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.skill_source_type.delete(id);
        await req.audit('skill_source_type', id, 'delete', {old: current});
        req.flash('success', 'Removed Source Types');
        res.redirect('/skill_source_type');
    } catch(err) {
        return next(err);
    }
}

async function reorder(req, res, next){
    try {
        for (const update of req.body){
            const skill_source_type = await req.models.skill_source_type.get(update.id);
            if (!skill_source_type || skill_source_type.campaign_id !== req.campaign.id){
                throw new Error ('Invalid record');
            }
            skill_source_type.display_order = update.display_order;
            await req.models.skill_source_type.update(update.id, skill_source_type);
        }
        res.json({success:true});
    }catch (err) {
        return next(err);
    }
}

const router = express.Router();

router.use(permission('gm'));
router.use(function(req, res, next){
    res.locals.siteSection='characters';
    next();
});

router.get('/', list);
router.get('/new', showNew);
router.get('/:id', showEdit);
router.get('/:id/edit', showEdit);
router.post('/', create);
router.put('/order', reorder);
router.put('/:id', update);
router.delete('/:id', permission('admin'), remove);

export default router;
