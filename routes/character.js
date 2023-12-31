const express = require('express');
const csrf = require('csurf');
const config = require('config');
const _ = require('underscore');
const async = require('async');
const createError = require('http-errors');
const permission = require('../lib/permission');
const validator = require('validator');
const Character = require('../lib/Character');


/* GET characters listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Characters'
    };
    try {
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;
        if (user.type === 'player'){
            res.locals.characters = await req.models.character.find({user_id:user.id, campaign_id:req.campaign.id});
        } else {
            const characters = await req.models.character.find({campaign_id:req.campaign.id});
            res.locals.characters = await async.map(characters, async (character) => {
                if (character.user_id){
                    character.user = await req.models.user.get(req.campaign.id, Number(character.user_id));
                }
                return character;
            });
        }
        res.locals.csrfToken = req.csrfToken();
        res.locals.title += ' - Characters';

        res.render('character/list', { pageTitle: 'Characters' });
    } catch (err){
        next(err);
    }
}

async function showCurrent(req, res, next){
    try{
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;
        if (user.type === 'player'){
            const character = await req.models.character.findOne({user_id: user.id, active: true, campaign_id:req.campaign.id});
            if (character){
                return res.redirect(`/character/${character.id}`);
            }
        }
        req.flash('warning', 'Character not found');
        return res.redirect('/character/list');
    } catch(err){
        next(err);
    }
}

async function show(req, res, next){
    let id = req.params.id;
    try{
        const character = new Character({id:id});
        await character.init();
        if (!character._data){
            req.flash('warning', 'Character not found');
            return res.redirect('character/list');
        }
        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }
        res.locals.character = await character.data();

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/character', name: 'Characters'},
            ],
            current: character.name
        };
        res.locals.audits = await character.audits();
        res.locals.title += ` - Character - ${character.name}`;

        res.render('character/show');
    } catch(err){
        next(err);
    }
}

async function showData(req, res, next){
    const id = req.params.id;
    try{
        const character = new Character({id:id});
        await character.init();
        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }
        res.json({success:true, character:await character.data()});
    } catch(err){
        next(err);
    }
}


async function showCp(req, res, next){
    const id = req.params.id;
    try{
        const character = new Character({id:id});
        await character.init();
        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }
        res.json({success:true, cp: await character.cp()});
    } catch(err){
        next(err);
    }
}

async function showAudits(req, res, next){
    const id = req.params.id;
    try{
        const character = new Character({id:id});
        await character.init();
        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }
        res.json({success:true, audits: await character.audits()});
    } catch(err){
        next(err);
    }
}

async function showPdf(req, res, next){
    const id = req.params.id;
    try{
        const character = new Character({id:id});
        await character.init();
        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }
        const pdf = await character.pdf(req.query.descriptions, req.query.languages);

        pdf.pipe(res);
        res.set('Content-Type', 'application/pdf');
        res.attachment(`${character.name.replace(/\//,'_')}.pdf`);
        pdf.end();

    } catch(err){
        next(err);
    }
}


async function showNew(req, res, next){
    try{
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;
        res.locals.character = {
            name: null,
            user_id: user.id,
            active: false,
            activeRequired: false,
            extra_traits: null,
        };
        if ((await req.models.character.find({user_id: user.id, campaign_id:req.campaign.id})).length === 0){
            res.locals.character.active = true;
            res.locals.character.activeRequired = true;
        }

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/character', name: 'Characters'},
            ],
            current: 'New'
        };
        res.locals.users = (await req.models.user.find(req.campaign.id)).filter(user => {
            return user.type !== 'none';
        });
        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'characterData')){
            res.locals.character = req.session.characterData;
            delete req.session.characterData;
        }
        res.locals.title += ' - New Character';

        res.render('character/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const character = await req.models.character.get(id);
        if (!character || character.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        res.locals.character = character;
        if (_.has(req.session, 'characterData')){
            res.locals.character = req.session.characterData;
            delete req.session.characterData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/character', name: 'Characters'},
            ],
            current: 'Edit: ' + character.name
        };
        res.locals.users = (await req.models.user.find(req.campaign.id)).filter(user => {
            return user.type !== 'none';
        });
        res.locals.title += ` - Edit Character - ${character.name}`;
        res.render('character/edit');
    } catch(err){
        next(err);
    }
}

async function clone(req, res, next){
    const id = req.params.id;

    try{
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;

        const character = new Character({cloneId: id, user_id: user.id});
        await character.init();

        await req.audit('character', character.id, 'clone', {from: id});
        res.json({success:true, url:`/character/${character.id}`});


    } catch (err) {
        res.json({success:false, error:err});
    }
}

async function create(req, res, next){
    const characterData = req.body.character;
    characterData.campaign_id = req.campaign.id;

    req.session.characterData = characterData;

    try{
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;
        if (user.type === 'player' || !characterData.user_id){
            characterData.user_id = user.id;
        }
        characterData.campaign_id = req.campaign.id;
        const character = new Character(characterData);
        await character.init();



        if (user.type === 'player' && (await req.models.character.find({user_id: user.id})).length === 1){
            await character.activate();
        } else if (_.has(characterData, 'active')){
            await character.activate();
        }

        delete req.session.characterData;
        await req.audit('character', character.id, 'create', {new: characterData});
        req.flash('success', 'Created Character ' + character.name);
        res.redirect(`/character/${character.id}`);
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/character/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const characterData = req.body.character;
    req.session.characterData = characterData;

    try {
        const oldCharacter = await req.models.character.get(id);
        if (oldCharacter.campaign_id!== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        const character = new Character({id:id});
        await character.init();

        await character.update(characterData);

        if (characterData.active){
            await character.activate();
        }

        delete req.session.characterData;
        req.flash('success', 'Updated Character ' + character.name);
        await req.audit('character', character.id, 'update', {old: oldCharacter, new: characterData});
        res.redirect(`/character/${id}`);
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/character/${id}/edit`));
    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.character.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.character.delete(id);
        await req.audit('character', id, 'delete', {old: current});
        req.flash('success', 'Removed Character');
        res.redirect('/character');
    } catch(err) {
        return next(err);
    }
}

async function showSkill(req, res, next){
    const characterId = req.params.id;
    const skillId = req.params.skill_id;
    try{
        const character = new Character({id:characterId});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        const doc = {
            character_skill: await character.skill(skillId)
        };
        if (!_.has(doc.character_skill, 'details') || !doc.character_skill.details){
            doc.character_skill.details = {};
        }
        for (const item of ['notes', 'trait', 'stat', 'style', 'language', 'tagskill', 'skill', 'crafting']){
            if (!_.has(doc.character_skill.details, item)){
                doc.character_skill.details[item] = null;
            }
        }
        res.json(doc);
    } catch(err){
        next(err);
    }
}

async function showSources(req, res, next){
    const characterId = req.params.id;
    try{
        const character = new Character({id:characterId});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        const doc = {
            csrfToken: req.csrfToken(),
            sources: await character.sources(),
            character_id: characterId
        };
        res.json(doc);
    } catch(err){
        next(err);
    }
}

async function showSkills(req, res, next){
    const characterId = req.params.id;
    try{
        const character = new Character({id:characterId});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        const doc = {
            csrfToken: req.csrfToken(),
            skills: await character.skills(),
            character_id: characterId
        };
        res.json(doc);
    } catch(err){
        next(err);
    }
}

async function showAddSkillApi(req, res, next){
    const characterId = req.params.id;
    try{
        const character = new Character({id:characterId});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        const doc = {
            csrfToken: req.csrfToken(),
            possibleSkills: await character.possibleSkills(),
        };
        doc.character_skill = {
            character_id: characterId,
            skill_id: null,
            details: {
                notes: null,
                trait: null,
                stat: null,
                style: null,
                language: null,
                tagskill: null,
                sheet_note: null,
                skill: null,
            }
        };
        if (_.has(req.session, 'characterSkillData')){
            doc.character_skill = req.session.characterSkillData;
            delete req.session.characterSkillData;
        }
        res.json(doc);
    } catch(err){
        next(err);
    }
}

async function showEditSkillApi(req, res, next){
    const characterId = req.params.id;
    const skillId = req.params.skill_id;
    try{
        const character = new Character({id:characterId});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        const doc = {
            csrfToken: req.csrfToken(),
            possibleSkills: [],
            character_skill: await character.skill(skillId)
        };

        if (!_.has(doc.character_skill, 'details') || !doc.character_skill.details){
            doc.character_skill.details = {};
        }
        for (const item of ['notes', 'trait', 'stat', 'style', 'sheet_note', 'language', 'tagskill', 'crafting']){
            if (!_.has(doc.character_skill.details, item)){
                doc.character_skill.details[item] = null;
            }
        }

        if (_.has(req.session, 'characterSkillData')){
            doc.character_skill = req.session.characterSkillData;
            delete req.session.characterSkillData;
        }
        res.json(doc);
    } catch(err){
        next(err);
    }
}

async function addSkill(req, res, next){
    const characterId = req.params.id;
    const skillId = Number(req.body.character_skill.skill_id);
    try{
        const character = new Character({id:characterId});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        try{
            const skill = await req.models.skill.get(skillId);
            if (!skill || skill.campaign_id !== req.campaign.id){
                throw new Error('Skill not found');
            }
            const details = formatDetails(skill.provides, req.body.character_skill.details);

            const characterSkillId = await character.addSkill(skillId, details);
            await req.audit('character', character.id, 'add skill', {skill: skillId, details: {new: details}});
            return res.json({success:true, skill: await character.skill(characterSkillId)});
        } catch (err){
            console.trace(err);
            return res.json({success:false, error: err});
        }
    } catch (err){
        next(err);
    }
}

async function editSkill(req, res, next){
    const characterId = req.params.id;
    const characterSkillId = req.params.skill_id;
    try{
        const character = new Character({id:characterId});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        try{
            const skill = await character.skill(characterSkillId);
            const oldDetails = JSON.parse(JSON.stringify(skill.details));

            if (!skill){
                throw new Error('Skill not found');
            }
            const details = formatDetails(skill.provides, req.body.character_skill.details);

            await character.updateSkillDetails(characterSkillId, details);
            await req.audit('character', character.id, 'update skill', {
                characterSkill: characterSkillId,
                skill: skill.id,
                details: {
                    old: oldDetails,
                    new:details
                }
            });

            const updatedSkill = await character.skill(characterSkillId);

            return res.json({success:true, skill: updatedSkill});
        } catch (err){
            return res.json({success:false, error: err});
        }
    } catch (err){
        next(err);
    }
}

function formatDetails(provides, data){
    const details = {};
    if (_.has(data, 'notes')){
        details.notes = data.notes;
    }
    if (_.has(data, 'sheet_note')){
        details.sheet_note = data.sheet_note;
    }

    if (_.isArray(provides) && provides.length){
        const provider = provides[0];
        switch (provider.type){
            case 'stat':
                if (provider.name.match(/^\s*\[/) && _.has(data, 'provides_value_select') && data.provides_value_select !== ''){
                    details.stat = data.provides_value_select;
                }
                break;
            case 'style':
                if (provider.value.match(/^\s*\[/) && _.has(data, 'provides_value_select') && data.provides_value_select !== ''){
                    details.style = data.provides_value_select;
                }
                break;
            case 'language':
                if (provider.value.match(/^\s*\[/) && _.has(data, 'provides_value_select') && data.provides_value_select !== ''){
                    details.language = data.provides_value_select;
                }
                break;
            case 'tagskill':
                if (provider.value.match(/^\s*\[/) && _.has(data, 'provides_value_select') && data.provides_value_select !== ''){
                    details.tagskill = data.provides_value_select;
                }
                break;
            case 'skill':
                if (provider.value.match(/^\s*\[/) && _.has(data, 'provides_value_select') && data.provides_value_select !== ''){
                    details.skill = data.provides_value_select;
                }
                break;
            case 'trait':
                if (provider.value === 'custom' && _.has(data, 'provides_value_text') && data.provides_value_text !== ''){
                    details.trait = data.provides_value_text;
                }
                break;
        }
    }
    return details;
}
async function removeSkill(req, res, next){
    const characterId = req.params.id;
    const skillId = req.params.skill_id;
    try{
        const character = new Character({id:characterId});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        try {
            const details = await character.removeSkill(skillId);
            await req.audit('character', character.id, 'remove skill', {characterSkill: details.id, skill: details.skill_id});
            return res.json({success:true, skill_id: details.id});
        } catch(err){
            return res.json({success:false, message:err});
        }
    } catch(err){
        next(err);
    }
}

async function showSource(req, res, next){
    const characterId = req.params.id;
    const sourceId = req.params.source_id;
    try{
        const character = new Character({id:characterId});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        const doc = {
            character_skill_source: await character.source(sourceId)
        };
        if (!_.has(doc.character_skill_source, 'details') || !doc.character_skill_source.details){
            doc.character_skill_source.details = {};
        }
        for (const item of ['notes', 'trait', 'stat', 'style']){
            if (!_.has(doc.character_skill_source.details, item)){
                doc.character_skill_source.details[item] = null;
            }
        }
        res.json(doc);
    } catch(err){
        next(err);
    }
}

async function showAddSourceApi(req, res, next){
    const characterId = req.params.id;
    try{
        const character = new Character({id:characterId});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        const doc = {
            csrfToken: req.csrfToken(),
            possibleSources: await character.possibleSources(req.campaign.id),
        };
        doc.character_skill_source = {
            character_id: characterId,
            skill_source_id: null,
            details: {
                notes: null,
                trait: null,
                stat: null,
                style: null,
            }
        };
        if (_.has(req.session, 'characterSkillSourceData')){
            doc.character_skill_source = req.session.characterSkillSourceData;
            delete req.session.characterSkillSourceData;
        }
        res.json(doc);
    } catch(err){
        next(err);
    }
}

async function addSource(req, res, next){
    const characterId = req.params.id;
    const sourceId = Number(req.body.character_skill_source.source_id);
    try{
        const character = new Character({id:characterId});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        try{
            const source = await req.models.skill_source.get(sourceId);
            if (!source || source.campaign_id !== req.campaign.id){
                throw new Error('Source not found');
            }
            await character.addSource(sourceId);
            await req.audit('character', character.id, 'add source', {source: sourceId});

            return res.json({success:true, source: await character.source(sourceId)});
        } catch (err){
            console.trace(err);
            return res.json({success:false, error: err.message});
        }
    } catch (err){
        next(err);
    }
}
async function removeSource(req, res, next){
    const characterId = req.params.id;
    const sourceId = req.params.source_id;
    try{
        const character = new Character({id:characterId});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        try {
            await character.removeSource(sourceId);
            await req.audit('character', character.id, 'remove source', {source: sourceId});
            return res.json({success:true});
        } catch(err){
            console.trace(err);
            return res.json({success:false, message:err});
        }
    } catch(err){
        next(err);
    }
}

async function recalculate(req, res, next){
    const id = req.params.id;
    try {
        const character = new Character({id:id});
        await character.init();

        if (character._data.campaign_id !== req.campaign.id){
            throw new Error('Invalid Character');
        }

        await character.recalculateCP();
        return res.json({success:true});
    } catch(err){
        return res.json({success:false, message:err});
    }
}

async function recalculateAll(req, res, next){
    try {

        const characters = await req.models.character.find({campaign_id:req.campaign.id});
        for (const characterData of characters){
            const character = new Character({id:characterData.id});
            await character.init();
            await character.recalculateCP();
        }
        return res.json({success:true});
    } catch(err){
        return res.json({success:false, message:err});
    }
}


async function checkAllowed(req, res, next){
    const characterId = req.params.id;
    if (!characterId){ return next(); }
    const character = await req.models.character.get(characterId);
    if (character.campaign_id !== req.campaign.id){
        throw new Error('Invalid Character');
    }
    const user = req.session.assumed_user ? req.session.assumed_user: req.user;
    if (!character){
        // No character found
        return next(createError(404));
    }
    if (character.user_id === user.id){
        // Everyone can update their own characters
        res.locals.allowedView = true;
        res.locals.allowedEdit = true;
        return next();
    }
    if (!user.type.match(/^(admin|core staff)$/)){
        // Event Staff can only View
        return next(createError(403));
    }
    res.locals.allowedView = true;
    res.locals.allowedEdit = true;
    next();
}

async function checkAllowedView(req, res, next){
    const characterId = req.params.id;
    if (!characterId){ return next(); }

    const character = await req.models.character.get(characterId);
    if (character.campaign_id !== req.campaign.id){
        throw new Error('Invalid Character');
    }
    const user = req.session.assumed_user ? req.session.assumed_user: req.user;

    if (!character){
        // No character found
        return next(createError(404));
    }
    if (character.user_id === user.id){
        // Everyone can update their own characters
        res.locals.allowedView = true;
        res.locals.allowedEdit = true;
        return next();
    }
    if (!user.type.match(/^(admin|core staff|contributing staff)$/)){
        // Event Staff can only View
        return next(createError(403));
    }
    if (user.type.match(/^(admin|core staff)$/)){
        res.locals.allowedView = true;
        res.locals.allowedEdit = true;
    } else {
        res.locals.allowedView = true;
        res.locals.allowedEdit = false;
    }

    next();
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

router.get('/',csrf(), list);
router.get('/new', csrf(), showNew);
router.put('/recalculate', csrf(), permission('gm'), recalculateAll);
router.get('/active', csrf(), showCurrent);
router.get('/:id', csrf(), checkAllowedView, show);
router.get('/:id/cp', csrf(), checkAllowedView, showCp);
router.get('/:id/data', csrf(), checkAllowedView, showData);
router.get('/:id/audit', csrf(), checkAllowedView, showAudits);
router.get('/:id/pdf', csrf(), checkAllowedView, showPdf);
router.get('/:id/edit', csrf(), checkAllowed, showEdit);
router.post('/', csrf(), create);
router.post('/:id/clone', checkAllowedView, csrf(), clone);
router.put('/:id', csrf(), checkAllowed, update);
router.put('/:id/recalculate', csrf, permission('gm'), recalculate);
router.delete('/:id', checkAllowed, remove);

router.get('/:id/skill', csrf(), checkAllowedView, showSkills);
router.get('/:id/skill/add', csrf(), checkAllowed, showAddSkillApi);
router.get('/:id/skill/:skill_id/edit', csrf(), checkAllowed, showEditSkillApi);
router.get('/:id/skill/:skill_id', csrf(), checkAllowedView, showSkill);
router.post('/:id/skill/', csrf(), checkAllowed, addSkill);
router.put('/:id/skill/:skill_id', csrf(), checkAllowed, editSkill);
router.delete('/:id/skill/:skill_id', csrf(), checkAllowed, removeSkill);

router.get('/:id/source', csrf(), checkAllowedView, showSources);
router.get('/:id/source/add', csrf(), checkAllowed, showAddSourceApi);
router.get('/:id/source/:source_id', csrf(), checkAllowedView, showSource);
router.post('/:id/source/', csrf(), checkAllowed, addSource);
router.delete('/:id/source/:source_id', csrf(), checkAllowed, removeSource);

router.put('/rebuild/:id');
module.exports = router;
