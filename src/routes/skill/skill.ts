import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import async from 'async';
import permission from '../../lib/permission';
import skillHelper from '../../lib/skillHelper';
import moment from 'moment';

/* GET skills listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Skills'
    };
    try {
        const skills: SkillModel[] = await req.models.skill.find({campaign_id:req.campaign.id});
        await async.each(skills, async(skill: SkillModel) => {
            if (skill.status.reviewable){
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
            res.attachment(`${req.campaign.name} Skills.csv`);
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
    if (req.checkPermission('npc')){
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
            ],
            current: 'Document'
        };
    } else{
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
            ],
            current: 'Skills'
        };
    }
    try {
        const sources = await req.models.skill_source.find({campaign_id:req.campaign.id});
        res.locals.sources = (await async.map(sources, async (source) => {
            source.skills = await req.models.skill.find({source_id:source.id});
            source.skills = source.skills.sort(skillHelper.sorter);
            source.skills = await async.map(source.skills, async (skill) => {
                skill.requires = (await async.map(skill.requires, async (requirement) => {
                    return req.models.skill.get(requirement);
                })).filter((item) => {
                    return item;
                });
                skill.conflicts = (await async.map(skill.conflicts, async (conflict) => {
                    return req.models.skill.get(conflict);
                })).filter((item) => {
                    return item;
                });
                return skill;
            });

            source.requires = (await async.map(source.requires, async (requirement) => {
                return req.models.skill_source.get(requirement);
            })).filter((item) => {
                return item;
            });
            source.conflicts = (await async.map(source.conflicts, async (conflict) => {
                return req.models.skill_source.get(conflict);
            })).filter((item) => {
                return item;
            });
            return source;
        })).sort(skillHelper.sourceSorter);
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
        skill.requires = (await async.map(skill.requires, async (requirement) => {
            return req.models.skill.get(requirement);
        })).filter((item) => {
            return item;
        });
        skill.conflicts = (await async.map(skill.conflicts, async (conflict) => {
            return req.models.skill.get(conflict);
        })).filter((item) => {
            return item;
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
        if (req.query.clone){
            const skill = await req.models.skill.get(req.query.clone);
            if(!skill || skill.campaign_id !== req.campaign.id){
                throw new Error('Invalid Skill');
            }
            delete skill.id;
            skill.status_id = (await req.models.skill_status.find({name: 'Idea'})).id;

            res.locals.skill = skill;
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/skill', name: 'Skills'},
                ],
                current: `Clone: ${skill.name}`

            };
            res.locals.title += ` - Clone Skill - ${skill.name}`;

        } else {
            res.locals.skill = {
                name: 'TBD',
                description: null,
                summary: null,
                notes: null,
                cost: null,
                source_id: req.query.skill_source?Number(req.query.skill_source):null,
                usage_id: null,
                status_id: (await req.models.skill_status.find({name: 'Idea'})).id,
                tags: [],
                requires: [],
                require_num: 0,
                conflicts: [],
                required: false,
                provides: []
            };

            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/skill', name: 'Skills'},
                ],
                current: 'New'
            };
            res.locals.title += ' - New Skill';
        }

        res.locals.csrfToken = req.csrfToken();
        res.locals.skill_sources = await req.models.skill_source.find({campaign_id: req.campaign.id});
        res.locals.skill_usages = await req.models.skill_usage.find({campaign_id: req.campaign.id});
        res.locals.skill_tags = await req.models.skill_tag.find({campaign_id: req.campaign.id});
        res.locals.skill_statuses = await req.models.skill_status.find({campaign_id: req.campaign.id});
        res.locals.providesTypes = skillHelper.getProvidesTypes('skill');
        res.locals.skills = (await req.models.skill.find({campaign_id: req.campaign.id})).sort(skillHelper.sorter);

        if (req.query.backto && ['list', 'source', 'skilldoc', 'sourcedoc', 'review', 'validate'].indexOf(req.query.backto) !== -1){
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
            skill_usages: await req.models.skill_usage.find({campaign_id: req.campaign.id}),
            skill_tags: await req.models.skill_tag.find({campaign_id: req.campaign.id}),
            skill_statuses: await req.models.skill_status.find({campaign_id: req.campaign.id}),
            providesTypes: skillHelper.getProvidesTypes('skill'),
            skills: (await req.models.skill.find({campaign_id: req.campaign.id})).sort(skillHelper.sorter),
            skill:null
        };

        if (req.query.clone){
            const skill: ModelData = await req.models.skill.get(req.query.clone);
            if(!skill || skill.campaign_id !== req.campaign.id){
                throw new Error('Invalid Skill');
            }
            delete skill.id;
            skill.status_id = (await req.models.skill_status.find({name: 'Idea'})).id;

            doc.skill = skill;

        } else {
            doc.skill = {
                name: 'TBD',
                description: null,
                summary: null,
                notes: null,
                cost: null,
                source_id: req.query.skill_source?Number(req.query.skill_source):null,
                usage_id: null,
                status_id: (_.findWhere(doc.skill_statuses, {name:'Idea'})).id,
                tags: [],
                requires: [],
                require_num: 0,
                conflicts: [],
                required: false,
                provides: []
            };
        }
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
        res.locals.skill = skill;
        if (_.has(req.session, 'skillData')){
            res.locals.skill = req.session.skillData;
            delete req.session.skillData;
        }

        res.locals.skill_sources = await req.models.skill_source.find({campaign_id: req.campaign.id});
        res.locals.skill_usages = await req.models.skill_usage.find({campaign_id: req.campaign.id});
        res.locals.skill_tags = await req.models.skill_tag.find({campaign_id: req.campaign.id});
        res.locals.skill_statuses = await req.models.skill_status.find({campaign_id: req.campaign.id});
        res.locals.providesTypes = skillHelper.getProvidesTypes('skill');
        res.locals.skills = (await req.models.skill.find({campaign_id: req.campaign.id})).sort(skillHelper.sorter);

        if (req.query.backto && ['list', 'source', 'skilldoc', 'sourcedoc', 'review', 'validate'].indexOf(req.query.backto) !== -1){
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
            skill_usages: await req.models.skill_usage.find({campaign_id: req.campaign.id}),
            skill_tags: await req.models.skill_tag.find({campaign_id: req.campaign.id}),
            skill_statuses: await req.models.skill_status.find({campaign_id: req.campaign.id}),
            providesTypes: skillHelper.getProvidesTypes('skill'),
            skills: (await req.models.skill.find({campaign_id: req.campaign.id})).sort(skillHelper.sorter)
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

async function create(req, res){
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

    skill.provides = skillHelper.parseProvides(skill.provides);

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
        for(const field of ['source_id', 'usage_id', 'status_id']){
            if (skill[field] === ''){
                skill[field] = null;
            }
        }
        for(const field of ['required']){
            if (!_.has(skill, field)){
                skill[field] = false;
            }
        }

        const id = await req.models.skill.create(skill);
        await req.audit('skill', id, 'create', {new:skill});
        delete req.session.skillData;
        if (req.body.backto && req.body.backto === 'modal'){
            const created = await req.models.skill.get(id);
            const skills = [];
            if (_.isArray(created.requires)){
                for (const skillId of created.requires){
                    skills.push(await req.models.skill.get(skillId));
                }
            }
            if (_.isArray(created.conflicts)){
                for (const skillId of created.conflicts){
                    skills.push(await req.models.skill.get(skillId));
                }
            }
            return res.json({success: true, update:false, skill: created, skills:skills});
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
        } else if (req.body.backto && req.body.backto === 'validate'){
            res.redirect('/skill/validate');
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

async function update(req, res){
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

    skill.provides = skillHelper.parseProvides(skill.provides);

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
        if (!req.checkPermission('gm')){
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
            for(const field of ['source_id', 'usage_id', 'status_id']){
                if (skill[field] === ''){
                    skill[field] = null;
                }
            }

            for(const field of ['required']){
                if (!_.has(skill, field)){
                    skill[field] = false;
                }
            }
        }

        await req.models.skill.update(id, skill);
        await req.audit('skill', id, 'update', {old: current, new:skill});
        delete req.session.skillData;
        if (req.body.backto && req.body.backto === 'modal'){
            const updated = await req.models.skill.get(id);
            const skills = [];
            if (_.isArray(updated.requires)){
                for (const skillId of updated.requires){
                    skills.push(await req.models.skill.get(skillId));
                }
            }
            if (_.isArray(updated.conflicts)){
                for (const skillId of updated.conflicts){
                    skills.push(await req.models.skill.get(skillId));
                }
            }
            return res.json({success: true, update:true, skill: updated, skills:skills});
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
        } else if (req.body.backto && req.body.backto === 'validate'){
            res.redirect('/skill/validate');
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

async function advance(req, res){
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

    try {
        const readyStatuses = await req.models.skill_status.find({reviewable: true, campaign_id:req.campaign.id});
        const readySkills = [];
        for (const status of readyStatuses){
            readySkills.push(await req.models.skill.find({status_id:status.id}));
        }
        const skills = _.flatten(readySkills).sort(skillHelper.sorter);

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
        res.locals.title += ' - Skill Review';
        res.render('skill/review');

    } catch (err){
        next(err);
    }
}

async function postReview(req, res) {
    const id = req.params.id;
    const review = {
        user_id: req.user.id,
        skill_id: Number(id),
        campaign_id: req.campaign.id,
        approved: false,
        content: null
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

async function showValidate(req, res, next){
    try {
        const skills = await req.models.skill.find({campaign_id: req.campaign.id});

        const issueSkills = [];
        const issueList = [];

        for (const skill of skills){
            const issues = await skillHelper.validate(skill);

            if (issues.length){
                skill.issues = issues;
                issueSkills.push(skill);
                for (const issue of issues){
                    if (!_.findWhere(issueList, {type: issue.type})){
                        issueList.push(issue);
                    }
                }
            }
        }

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/skill', name: 'Skills'},
            ],
            current: 'Validation'
        };
        res.locals.skills = issueSkills;
        res.locals.issueList = issueList;
        res.locals.title += ' - Skill Validation';
        res.render('skill/validate');


    } catch (err) {
        next(err);
    }
}

const router = express.Router();

router.use(permission('player'));
router.use(function(req, res, next){
    res.locals.siteSection=['character', 'gm'];
    next();
});

router.get('/', permission('contrib'), list);
router.get('/doc', listDoc);
router.get('/new', permission('gm'), csrf(), showNew);
router.get('/review', permission('gm'), csrf(), showReview);
router.get('/validate', permission('gm'), csrf(), showValidate);
router.get('/new/api',  permission('gm'), csrf(), showNewApi);
router.get('/:id', permission('contrib'), csrf(), show);
router.get('/:id/edit', permission('contrib'), csrf(),showEdit);
router.get('/:id/edit/api',permission('contrib'),  csrf(),  showEditApi);
router.post('/', permission('gm'), csrf(), create);
router.post('/:id/review', permission('gm'), postReview);
router.put('/:id', permission('contrib'), csrf(), update);
router.put('/:id/advance', permission('admin'), advance);
router.delete('/:id', permission('admin'), remove);

export default router;
