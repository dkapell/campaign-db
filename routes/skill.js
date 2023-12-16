const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const async = require('async');
const permission = require('../lib/permission');
const validator = require('validator');
const skillHelper = require('../lib/skillHelper');
const moment = require('moment');

/* GET skills listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Skills'
    };
    try {
        const skills = await req.models.skill.find({campaign_id:req.campaign.id});
        await async.each(skills, async(skill) => {
            if (skill.status.name === 'Ready'){
                const reviews = await req.models.skill_review.find({skill_id:skill.id, approved:true});

                skill.approvals = reviews.filter(review => {return review.created > skill.updated;}).length;
            }
        });
        if (req.query.export){
            let forPlayers = false;
            if (req.query.player){
                forPlayers = true;
            }
            const output = await skillHelper.getCSV(skills, forPlayers);
            res.attachment('Ritual Skills.csv');
            res.end(output);
        } else {
            res.locals.skills = skills;
            res.locals.wideMain = true;
            res.locals.title += ' - Skills';
            res.render('skill/list');
        }
    } catch (err){
        next(err);
    }
}

async function listDoc(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/skill', name: 'Skills'},
        ],
        current: 'Document'
    };
    try {
        const sources = await req.models.skill_source.find({campaign_id:req.campaign.id});
        res.locals.sources = await async.map(sources, async (source) => {
            source.skills = await req.models.skill.find({source_id:source.id});
            source.skills = source.skills.sort(skillHelper.sorter);
            source.skills = await async.map(source.skills, async (skill) => {
                skill.requires = await async.map(skill.requires, async (requirement) => {
                    return req.models.skill.get(requirement);
                });
                skill.conflicts = await async.map(skill.conflicts, async (conflict) => {
                    return req.models.skill.get(conflict);
                });
                return skill;
            });

            source.requires = await async.map(source.requires, async (requirement) => {
                return req.models.skill_source.get(requirement);
            });
            source.conflicts = await async.map(source.conflicts, async (conflict) => {
                return req.models.skill_source.get(conflict);
            });
            return source;
        });
        res.locals.title += ' - Skill List';
        res.render('skill/document');
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const skill = await req.models.skill.get(id);
        if(!skill || skill.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
            ],
            current: skill.name
        };
        skill.requires = await async.map(skill.requires, async (requirement) => {
            return req.models.skill.get(requirement);
        });
        skill.conflicts = await async.map(skill.conflicts, async (conflict) => {
            return req.models.skill.get(conflict);
        });
        skill.updatedFormatted = moment(skill.updated).format('lll');
        res.locals.skill = skill;

        const audits = await req.models.audit.find({object_type: 'skill', object_id: id});
        res.locals.audits = await async.map(audits, async (audit) => {
            audit.createdFormated = moment(audit.created).format('lll');
            audit.diff = await skillHelper.diff(audit.data.old, audit.data.new);
            return audit;
        });
        res.locals.title += ` - Skill - ${skill.name}`;
        res.render('skill/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        res.locals.skill = {
            name: 'TBD',
            description: null,
            summary: null,
            notes: null,
            cost: null,
            source_id: req.query.skill_source?Number(req.query.skill_source):null,
            usage_id: null,
            type_id: null,
            status_id: (await req.models.skill_status.find({name: 'Idea'})).id,
            tags: [],
            requires: [],
            require_num: 0,
            conflicts: [],
            provides: skillHelper.fillProvides(null, 2)
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();
        res.locals.skill_sources = await req.models.skill_source.find({campaign_id: req.campaign.id});
        res.locals.skill_types = await req.models.skill_type.find({campaign_id: req.campaign.id});
        res.locals.skill_usages = await req.models.skill_usage.find({campaign_id: req.campaign.id});
        res.locals.skill_tags = await req.models.skill_tag.find({campaign_id: req.campaign.id});
        res.locals.skill_statuses = await req.models.skill_status.find({campaign_id: req.campaign.id});
        res.locals.skills = (await req.models.skill.find({campaign_id: req.campaign.id})).sort(skillHelper.sorter);

        if (req.query.backto && ['list', 'source', 'skilldoc', 'sourcedoc', 'review'].indexOf(req.query.backto) !== -1){
            res.locals.backto = req.query.backto;
        }

        if (_.has(req.session, 'skillData')){
            res.locals.skill = req.session.skillData;
            delete req.session.skillData;
        }
        res.locals.title += ' - New Skill';
        res.render('skill/new');
    } catch (err){
        next(err);
    }
}

async function showNewApi(req, res, next){
    try{
        const doc = {
            csrfToken: req.csrfToken(),
            skill_sources: await req.models.skill_source.find({campaign_id: req.campaign.id}),
            skill_types: await req.models.skill_type.find({campaign_id: req.campaign.id}),
            skill_usages: await req.models.skill_usage.find({campaign_id: req.campaign.id}),
            skill_tags: await req.models.skill_tag.find({campaign_id: req.campaign.id}),
            skill_statuses: await req.models.skill_status.find({campaign_id: req.campaign.id}),
            skills: (await req.models.skill.find({campaign_id: req.campaign.id})).sort(skillHelper.sorter)
        };
        doc.skill = {
            name: 'TBD',
            description: null,
            summary: null,
            notes: null,
            cost: null,
            source_id: req.query.skill_source?Number(req.query.skill_source):null,
            usage_id: null,
            type_id: null,
            status_id: (_.findWhere(doc.skill_statuses, {name:'Idea'})).id,
            tags: [],
            requires: [],
            require_num: 0,
            conflicts: [],
            provides: skillHelper.fillProvides(null, 2)
        };
        if (_.has(req.session, 'skillData')){
            doc.skill = req.session.skillData;
            delete req.session.skillData;
        }
        res.json(doc);
    } catch(err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const skill = await req.models.skill.get(id);
        if(!skill || skill.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill');
        }
        skill.provides = skillHelper.fillProvides(skill.provides, 2);
        res.locals.skill = skill;
        if (_.has(req.session, 'skillData')){
            res.locals.skill = req.session.skillData;
            delete req.session.skillData;
        }

        res.locals.skill_sources = await req.models.skill_source.find({campaign_id: req.campaign.id});
        res.locals.skill_types = await req.models.skill_type.find({campaign_id: req.campaign.id});
        res.locals.skill_usages = await req.models.skill_usage.find({campaign_id: req.campaign.id});
        res.locals.skill_tags = await req.models.skill_tag.find({campaign_id: req.campaign.id});
        res.locals.skill_statuses = await req.models.skill_status.find({campaign_id: req.campaign.id});
        res.locals.skills = (await req.models.skill.find({campaign_id: req.campaign.id})).sort(skillHelper.sorter);

        if (req.query.backto && ['list', 'source', 'skilldoc', 'sourcedoc', 'review'].indexOf(req.query.backto) !== -1){
            res.locals.backto = req.query.backto;
        }

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
            ],
            current: 'Edit: ' + skill.name
        };
        res.locals.title += ` - Edit Skill - ${skill.name}`;
        res.render('skill/edit');
    } catch(err){
        next(err);
    }
}



async function showEditApi(req, res, next){
    const id = req.params.id;
    try{
        const skill = await req.models.skill.get(id);
        if(!skill || skill.campaign_id !== req.campaign.id){
            throw new Error('Invalid Skill');
        }
        const doc = {
            csrfToken: req.csrfToken(),
            skill: skill,
            skill_sources: await req.models.skill_source.find({campaign_id: req.campaign.id}),
            skill_types: await req.models.skill_type.find({campaign_id: req.campaign.id}),
            skill_usages: await req.models.skill_usage.find({campaign_id: req.campaign.id}),
            skill_tags: await req.models.skill_tag.find({campaign_id: req.campaign.id}),
            skill_statuses: await req.models.skill_status.find({campaign_id: req.campaign.id}),
            skills: (await req.models.skill.find({campaign_id: req.campaign.id})).sort(skillHelper.sorter)
        };
        doc.skill.provides = skillHelper.fillProvides(doc.skill.provides, 2);
        if (_.has(req.session, 'skillData')){
            doc.skill = req.session.skillData;
            delete req.session.skillData;
        }
        res.json(doc);
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const skill = req.body.skill;

    req.session.skillData = skill;

    if (skill.conflicts && _.isString(skill.conflicts)){
        skill.conflicts = [skill.conflicts];
    }
    if (skill.requires && _.isString(skill.requires)){
        skill.requires = [skill.requires];
    }
    if (skill.provides && _.isString(skill.provides)){
        skill.provides = [skill.provides];
    }
    skill.provides = skill.provides.filter(provider => {
        return provider.type !== '-1';
    });

    skill.conflicts = skill.conflicts?JSON.stringify(skill.conflicts.map(e => {return Number(e);})):[];
    skill.requires = skill.requires?JSON.stringify(skill.requires.map(e => {return Number(e);})):[];
    skill.provides = skill.provides?JSON.stringify(skill.provides):[];
    if (skill.requires.length){
        if (!skill.require_num){
            skill.require_num = 1;
        }
    } else {
        skill.require_num = 0;
    }
    skill.campaign_id = req.campaign.id;

    try{
        if (!skill.tags){
            skill.tags = [];
        } else if(!_.isArray(skill.tags)){
            skill.tags = [skill.tags];
        }
        for(const field of ['source_id', 'type_id', 'usage_id', 'status_id']){
            if (skill[field] === ''){
                skill[field] = null;
            }
        }
        const id = await req.models.skill.create(skill);
        await req.audit('skill', id, 'create', {new:skill});
        delete req.session.skillData;
        if (req.body.backto && req.body.backto === 'modal'){
            return res.json({success: true, update: false, skill: await req.models.skill.get(id)});
        }
        req.flash('success', 'Created Skill ' + skill.name);
        if (req.body.backto && req.body.backto === 'list'){
            res.redirect('/skill');
        } else if (req.body.backto && req.body.backto === 'source'){
            res.redirect(`/skill_source/${skill.source_id}`);
        } else if (req.body.backto && req.body.backto === 'skilldoc'){
            res.redirect('/skill/doc');
        } else if (req.body.backto && req.body.backto === 'review'){
            res.redirect('/skill/review');
        } else if (req.body.backto && req.body.backto === 'sourcedoc'){
            res.redirect(`/skill_source/${skill.source_id}/doc`);
        } else {
            res.redirect(`/skill/${id}`);
        }
    } catch (err) {
        if (req.body.backto && req.body.backto === 'modal'){
            console.trace(err);
            return res.json({success:false, error: err});
        }
        req.flash('error', err.toString());
        return res.redirect('/skill/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const skill = req.body.skill;
    req.session.skillData = skill;

    if (skill.conflicts && _.isString(skill.conflicts)){
        skill.conflicts = [skill.conflicts];
    }
    if (skill.requires && _.isString(skill.requires)){
        skill.requires = [skill.requires];
    }
    if (skill.provides && _.isString(skill.provides)){
        skill.provides = [skill.provides];
    }

    skill.provides = skill.provides.filter(provider => {
        return provider.type !== '-1';
    });

    skill.conflicts = skill.conflicts?JSON.stringify(skill.conflicts.map(e => {return Number(e);})):[];
    skill.requires = skill.requires?JSON.stringify(skill.requires.map(e => {return Number(e);})):[];
    skill.provides = skill.provides?JSON.stringify(skill.provides):[];
    if (skill.requires.length){
        if (!skill.require_num){
            skill.require_num = 1;
        }
    } else {
        skill.require_num = 0;
    }
    skill.updated = new Date();

    try {
        const current = await req.models.skill.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        if (!res.locals.checkPermission('gm')){
            for (const field in current){
                if (field !== 'notes'){
                    skill[field] = current[field];
                }
            }

        } else {

            if (!skill.tags){
                skill.tags = [];
            } else if(!_.isArray(skill.tags)){
                skill.tags = [skill.tags];
            }
            for(const field of ['source_id', 'type_id', 'usage_id', 'status_id']){
                if (skill[field] === ''){
                    skill[field] = null;
                }
            }
        }

        await req.models.skill.update(id, skill);
        await req.audit('skill', id, 'update', {old: current, new:skill});
        delete req.session.skillData;
        if (req.body.backto && req.body.backto === 'modal'){
            return res.json({success: true, update:true, skill: await req.models.skill.get(id)});
        }

        req.flash('success', 'Updated Skill ' + skill.name);
        if (req.body.backto && req.body.backto === 'list'){
            res.redirect('/skill');
        } else if (req.body.backto && req.body.backto === 'source'){
            res.redirect(`/skill_source/${skill.source_id}`);
        } else if (req.body.backto && req.body.backto === 'skilldoc'){
            res.redirect('/skill/doc');
        } else if (req.body.backto && req.body.backto === 'review'){
            res.redirect('/skill/review');
        } else if (req.body.backto && req.body.backto === 'sourcedoc'){
            res.redirect(`/skill_source/${skill.source_id}/doc`);
        } else {
            res.redirect(`/skill/${id}`);
        }
    } catch(err) {
        if (req.body.backto && req.body.backto === 'modal'){
            console.trace(err);
            return res.json({success:false, error: err});
        }
        req.flash('error', err.toString());
        return (res.redirect(`/skill/${id}/edit`));
    }
}

async function advance(req, res, next){
    const id = req.params.id;

    try {
        const current = await req.models.skill.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        const old = JSON.parse(JSON.stringify(current));

        const statuses = await req.models.skill_status.find({campaign_id: req.campaign.id});
        const current_status = _.findWhere(statuses, {id: current.status_id});
        if (!current_status || !current_status.advanceable){
            return res.json({success: true, update:false, skill: await req.models.skill.get(id)});
        }
        const next_status = _.findWhere(statuses, {display_order: current_status.display_order + 1});
        if (!next_status){
            return res.json({success: false, error: 'Next status not found'});
        }
        current.updated = new Date();
        current.status_id = next_status.id;
        await req.models.skill.update(id, current);
        await req.audit('skill', id, 'update', {old: old, new:current});
        return res.json({success: true, update:true, skill: await req.models.skill.get(id)});

    } catch(err) {
        console.trace(err);
        return res.json({success:false, error: err});
    }
}

async function remove(req, res, next){
    const id = req.params.id;

    try {
        const current = await req.models.skill.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.skill.delete(id);
        await req.audit('skill', id, 'delete', {old: current});
        req.flash('success', `Removed Skill ${current.name}`);
        res.redirect('/skill');
    } catch(err) {
        return next(err);
    }
}

async function showReview(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/skill', name: 'Skills'},
        ],
        current: 'Review'
    };
    const status = req.query.status? req.query.status : 'Ready';
    try {
        const readyStatus = await req.models.skill_status.findOne({name: status, campaign_id:req.campaign.id});

        const skills = (await req.models.skill.find({status_id:readyStatus.id})).sort(skillHelper.sorter);

        res.locals.skills = await async.mapLimit(skills, 5, async (skill) => {
            if (skill.requires.length){
                skill.requires = await async.map(skill.requires, async (requirement) => {
                    return req.models.skill.get(requirement);
                });
            }
            if (skill.conflicts.length){
                skill.conflicts = await async.map(skill.conflicts, async (conflict) => {
                    return req.models.skill.get(conflict);
                });
            }
            skill.reviews = await req.models.skill_review.find({skill_id: skill.id});
            skill.approved = false;
            for (const review of skill.reviews){
                if (review.approved && review.user_id === req.user.id && review.created.getTime() > skill.updated.getTime()){
                    skill.approved = true;
                }
            }
            skill.updatedFormatted = moment(skill.updated).format('lll');
            return skill;
        });
        res.locals.title += ` - Skill Review - ${status} Skills`;
        res.render('skill/review');

    } catch (err){
        next(err);
    }
}

async function postReview(req, res, next) {
    const id = req.params.id;
    const review = {
        user_id: req.user.id,
        skill_id: Number(id),
        campaign_id: req.campaign.id
    };
    let valid = false;
    if (req.body.approved){
        review.approved = true;
        valid = true;
    }
    if (req.body.content){
        review.content = req.body.content;
        valid = true;
    }
    if (!valid){
        return res.json({success:true});
    }
    try{
        await req.models.skill_review.create(review);
        res.json({success:true});
    } catch (err){
        console.trace(err);
        res.json({success:false, error: err.message});
    }
}

const router = express.Router();

router.use(permission('player'));
router.use(function(req, res, next){
    const user = req.session.assumed_user ? req.session.assumed_user: req.user;
    if (user.type === 'player'){
        res.locals.siteSection='character';
    } else {
        res.locals.siteSection='gm';
    }
    next();
});

router.get('/', permission('contrib'), list);
router.get('/doc', listDoc);
router.get('/new', permission('gm'), csrf(), showNew);
router.get('/review', permission('gm'), csrf(), showReview);
router.get('/new/api',  permission('gm'), csrf(), showNewApi);
router.get('/:id', permission('contrib'), csrf(), show);
router.get('/:id/edit', permission('contrib'), csrf(),showEdit);
router.get('/:id/edit/api',permission('contrib'),  csrf(),  showEditApi);
router.post('/', permission('gm'), csrf(), create);
router.post('/:id/review', permission('gm'), postReview);
router.put('/:id', permission('contrib'), csrf(), update);
router.put('/:id/advance', permission('admin'), advance);
router.delete('/:id', permission('admin'), remove);

module.exports = router;
