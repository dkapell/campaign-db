const express = require('express');
const csrf = require('csurf');
const async = require('async');
const _ = require('underscore');
const permission = require('../lib/permission');
const validator = require('validator');
const skillHelper = require('../lib/skillHelper');

/* GET skill_sources listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/skill', name: 'Skills'},
        ],
        current: 'Sources'
    };
    try {
        const skill_sources = await req.models.skill_source.find({campaign_id:req.campaign.id});
        res.locals.skill_sources = await async.map ( skill_sources, async (source) => {
            source.skills = await req.models.skill.find({source_id:source.id}, {skipRelations:true});
            return source;
        });
        res.locals.title += ' - Skill Sources';
        res.render('skill_source/list', { pageTitle: 'Skill Sources' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const skill_source = await req.models.skill_source.get(id);
        if (!skill_source || skill_source.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Source');
        }
        const skills = await req.models.skill.find({source_id:id});
        await async.each(skills, async(skill) => {
            if (skill.status.reviewable){
                const reviews = await req.models.skill_review.find({skill_id:skill.id, approved:true});

                skill.approvals = reviews.filter(review => {return review.created > skill.updated;}).length;
            }
            if (skill.requires && _.isArray(skill.requires)){
                skill.requires = await async.map(skill.requires, async (skillId) => { return req.models.skill.get(skillId); })
            }
            if (skill.conflicts && _.isArray(skill.conflicts)){
                skill.conflicts = await async.map(skill.conflicts, async(skillId) => { return req.models.skill.get(skillId); })
            }
        });
        if (req.query.export){
            let forPlayers = false;
            if (req.query.player){
                forPlayers = true;
            }
            const output = await skillHelper.getCSV(skills, forPlayers);
            res.attachment(`${req.campaign.name} Skills - ${skill_source.name}.csv`);
            res.end(output);
        } else {
            skill_source.requires = await async.map(skill_source.requires, async (requirement) => {
                return req.models.skill_source.get(requirement);
            });
            skill_source.conflicts = await async.map(skill_source.conflicts, async (conflict) => {
                return req.models.skill_source.get(conflict);
            });
            res.locals.skill_source = skill_source;
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/skill', name: 'Skills'},
                    { url: '/skill_source', name: 'Sources'},
                ],
                current: skill_source.name
            };
            res.locals.wideMain = true;
            res.locals.skills = skills;
            res.locals.title += ` - Skill Source - ${skill_source.name}`;
            res.render('skill_source/show');
        }
    } catch(err){
        next(err);
    }
}

async function showDoc(req, res, next){
    const id = req.params.id;
    try {
        const skill_source = await req.models.skill_source.get(id);
        if (!skill_source || skill_source.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Source');
        }
        res.locals.skill_source = skill_source;

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_source', name: 'Sources'},
                { url: `/skill_source/${id}`, name: skill_source.name},

            ],
            current: 'Document'
        };

        skill_source.skills = await req.models.skill.find({source_id:skill_source.id});
        skill_source.skills = skill_source.skills.sort(skillHelper.sorter);
        skill_source.skills = await async.map(skill_source.skills, async (skill) => {
            skill.requires = await async.map(skill.requires, async (requirement) => {
                return req.models.skill.get(requirement);
            });
            skill.conflicts = await async.map(skill.conflicts, async (conflict) => {
                return req.models.skill.get(conflict);
            });
            return skill;
        });

        skill_source.requires = await async.map(skill_source.requires, async (requirement) => {
            return req.models.skill_source.get(requirement);
        });
        skill_source.conflicts = await async.map(skill_source.conflicts, async (conflict) => {
            return req.models.skill_source.get(conflict);
        });
        res.locals.source = skill_source;
        res.locals.title += ` - Skill Source Document- ${skill_source.name}`;
        res.render('skill_source/document');
    } catch (err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        res.locals.skill_source = {
            name: null,
            description: null,
            notes: null,
            type_id: null,
            cost: 0,
            required: false,
            display_to_pc: false,
            requires: [],
            require_num: 1,
            conflicts: [],
            provides: []
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_source', name: 'Sources'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();
        res.locals.skill_source_types = await req.models.skill_source_type.find({campaign_id:req.campaign.id});
        res.locals.skill_sources = await req.models.skill_source.find({campaign_id:req.campaign.id});
        res.locals.providesTypes = skillHelper.getProvidesTypes('source');

        if (_.has(req.session, 'skill_sourceData')){
            res.locals.skill_source = req.session.skill_sourceData;
            delete req.session.skill_sourceData;
        }

        if (req.query.backto && ['list', 'source', 'skilldoc', 'sourcedoc'].indexOf(req.query.backto) !== -1){
            res.locals.backto = req.query.backto;
        }
        res.locals.title += ' - New Skill Source';

        res.render('skill_source/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const skill_source = await req.models.skill_source.get(id);
        if (!skill_source || skill_source.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill Source');
        }

        res.locals.skill_source = skill_source;
        if (_.has(req.session, 'skill_sourceData')){
            res.locals.skill_source = req.session.skill_sourceData;
            delete req.session.skill_sourceData;
        }
        res.locals.skill_source_types = await req.models.skill_source_type.find({campaign_id:req.campaign.id});
        res.locals.skill_sources = await req.models.skill_source.find({campaign_id:req.campaign.id});
        res.locals.providesTypes = skillHelper.getProvidesTypes('source');

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
                { url: '/skill_source', name: 'Sources'},
            ],
            current: 'Edit: ' + skill_source.name
        };

        if (req.query.backto && ['list', 'source', 'skilldoc', 'sourcedoc'].indexOf(req.query.backto) !== -1){
            res.locals.backto = req.query.backto;
        }

        res.locals.title += ` - Edit Skill Source - ${skill_source.name}`;
        res.render('skill_source/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const skill_source = req.body.skill_source;

    req.session.skill_sourceData = skill_source;
    if (!_.has(skill_source, 'required')){
        skill_source.required = false;
    }
    if (!_.has(skill_source, 'display_to_pc')){
        skill_source.display_to_pc = false;
    }

    if (skill_source.conflicts && _.isString(skill_source.conflicts)){
        skill_source.conflicts = [skill_source.conflicts];
    }
    if (skill_source.requires && _.isString(skill_source.requires)){
        skill_source.requires = [skill_source.requires];
    }
    if (skill_source.provides && _.isString(skill_source.provides)){
        skill_source.provides = [skill_source.provides];
    }
    skill_source.provides = skillHelper.parseProvides(skill_source.provides);

    skill_source.conflicts = skill_source.conflicts?JSON.stringify(skill_source.conflicts.map(e => {return Number(e);})):[];
    skill_source.requires = skill_source.requires?JSON.stringify(skill_source.requires.map(e => {return Number(e);})):[];
    skill_source.provides = skill_source.provides?JSON.stringify(skill_source.provides):[];
    if (skill_source.requires.length){
        if (!skill_source.require_num){
            skill_source.require_num = 1;
        }
    } else {
        skill_source.require_num = 0;
    }
    skill_source.campaign_id = req.campaign.id;

    try{
        const id = await req.models.skill_source.create(skill_source);
        await req.audit('skill_source', id, 'create', {new:skill_source});
        delete req.session.skill_sourceData;
        req.flash('success', 'Created Source ' + skill_source.name);

        if (req.body.backto && req.body.backto === 'list'){
            res.redirect('/skill_source');
        } else if (req.body.backto && req.body.backto === 'source'){
            res.redirect(`/skill_source/${id}`);
        } else if (req.body.backto && req.body.backto === 'skilldoc'){
            res.redirect('/skill/doc');
        } else if (req.body.backto && req.body.backto === 'sourcedoc'){
            res.redirect(`/skill_source/${id}/doc`);
        } else {
            res.redirect(`/skill_source/${id}`);
        }

    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/skill_source/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const skill_source = req.body.skill_source;
    req.session.skill_sourceData = skill_source;
    if (!_.has(skill_source, 'required')){
        skill_source.required = false;
    }
    if (!_.has(skill_source, 'display_to_pc')){
        skill_source.display_to_pc = false;
    }

    if (skill_source.conflicts && _.isString(skill_source.conflicts)){
        skill_source.conflicts = [skill_source.conflicts];
    }
    if (skill_source.requires && _.isString(skill_source.requires)){
        skill_source.requires = [skill_source.requires];
    }
    if (skill_source.provides && _.isString(skill_source.provides)){
        skill_source.provides = [skill_source.provides];
    }
    skill_source.provides = skillHelper.parseProvides(skill_source.provides);

    skill_source.conflicts = skill_source.conflicts?JSON.stringify(skill_source.conflicts.map(e => {return Number(e);})):[];
    skill_source.requires = skill_source.requires?JSON.stringify(skill_source.requires.map(e => {return Number(e);})):[];
    skill_source.provides = skill_source.provides?JSON.stringify(skill_source.provides):[];
    if (skill_source.requires.length){
        if (!Number(skill_source.require_num)){
            skill_source.require_num = 1;
        }
    } else {
        skill_source.require_num = 0;
    }

    try {
        const current = await req.models.skill_source.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.skill_source.update(id, skill_source);
        await req.audit('skill_source', id, 'update', {old: current, new:skill_source});
        delete req.session.skill_sourceData;
        req.flash('success', 'Updated Source ' + skill_source.name);
        if (req.body.backto && req.body.backto === 'list'){
            res.redirect('/skill_source');
        } else if (req.body.backto && req.body.backto === 'source'){
            res.redirect(`/skill_source/${id}`);
        } else if (req.body.backto && req.body.backto === 'skilldoc'){
            res.redirect('/skill/doc');
        } else if (req.body.backto && req.body.backto === 'sourcedoc'){
            res.redirect(`/skill_source/${id}/doc`);
        } else {
            res.redirect(`/skill_source/${id}`);
        }
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/skill_source/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.skill_source.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not remove record from different campaign');
        }
        await req.models.skill_source.delete(id);
        await req.audit('skill_source', id, 'delete', {old: current});
        req.flash('success', 'Removed Sources');
        res.redirect('/skill_source');
    } catch(err) {
        return next(err);
    }
}

const router = express.Router();

router.use(permission('contrib'));
router.use(function(req, res, next){
    res.locals.siteSection='gm';
    next();
});

router.get('/', list);
router.get('/new',  permission('gm'), csrf(), showNew);
router.get('/:id', csrf(), show);
router.get('/:id/doc', csrf(), showDoc);
router.get('/:id/edit',  permission('gm'), csrf(),showEdit);
router.post('/',  permission('gm'), csrf(), create);
router.put('/:id',  permission('gm'), csrf(), update);
router.delete('/:id', permission('admin'), remove);

module.exports = router;
