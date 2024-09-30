import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import async from 'async';
import permission from '../lib/permission';
import reportHelper from '../lib/reportHelper';

function list (req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'}
        ],
        current: 'Reports'
    };
    try {
        res.locals.csrfToken = req.csrfToken();
        res.render('report/list', { pageTitle: 'Reports' });
    } catch (err){
        next(err);
    }
}

async function showGroupReport(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/report', name: 'Reports'},
        ],
        current: 'Character Group Report'
    };
    try{
        const characters = await req.models.character.find({active:true, campaign_id: req.campaign.id});
        res.locals.characters = await async.map(characters, async (character) => {
            if (character.user_id){
                character.user = await req.models.user.get(req.campaign.id, Number(character.user_id));
            }
            return character;
        });
        res.locals.csrfToken = req.csrfToken();
        res.render('report/group', { pageTitle: 'Character Group Report' });
    } catch (err){
        next(err);
    }

}

async function getGroupReportData(req, res, next){
    try{
        if (!req.query.characters){
            return  res.json(await reportHelper.data([], req.campaign.id));
        }
        const characterIds = req.query.characters.split(/\s*,\s*/);

        res.json(await reportHelper.data(characterIds, req.campaign.id));
    } catch(err){
        next(err);
    }
}

async function showSkillReport(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/report', name: 'Reports'},
        ],
        current: 'Skill Report'
    };
    try{
        res.locals.skill_usages = await req.models.skill_usage.find({campaign_id:req.campaign.id});
        res.locals.skill_tags = await req.models.skill_tag.find({campaign_id:req.campaign.id});
        res.locals.skill_sources = await req.models.skill_source.find({campaign_id:req.campaign.id});
        res.locals.csrfToken = req.csrfToken();
        res.render('report/skill', { pageTitle: 'Character Skill Report' });
    } catch (err){
        next(err);
    }
}

async function getSkillReportSkills(req, res, next){
    try{
        const conditions = {
            campaign_id: req.campaign.id
        };
        for (const type of ['usage_id', 'source_id', 'tag_id', 'search']){
            if (_.has(req.query, type) && Number(req.query[type]) !== -1){
                conditions[type] = req.query[type];
            }
        }
        let results = await req.models.skill.search(conditions);
        results = _.uniq(results, 'id');
        if (req.query.groupByName){
            const groupedResults = _.groupBy(results, 'name');

            results = [];
            for (const name in groupedResults){
                if (groupedResults[name].length === 1){
                    results.push(groupedResults[name][0]);
                } else {
                    const doc = groupedResults[name][0];
                    doc.source.name = 'Multiple';
                    results.push(doc);
                }
            }
            results = _.sortBy(results, 'name');
        }

        res.json({results: results.map(e => {
            return {
                id: e.id,
                name: e.name,
                source: e.source?e.source.name:'unset',
                tags: e.tags,
                usage: e.usage?e.usage.name:'unset',
                text: e.name?e.name:'TBD',
                summary: e.summary
            };
        })});
    } catch (err){
        next(err);
    }
}

async function getSkillReportData(req, res, next){
    const counts = {
        staff: 0,
        inactive: 0,
        total: 0
    };
    if (!req.query.skill_id){
        return res.json({characters:[], skill:null, counts: counts});
    }
    try{
        const chosenSkill = await req.models.skill.get(req.query.skill_id);
        if (! chosenSkill || chosenSkill.campaign_id !== req.campaign.id){
            return res.json({characters:[], skill:null, counts: counts});
        }
        let skills = [chosenSkill];
        if (req.query.groupByName){
            skills = await req.models.skill.find({campaign_id: req.campaign.id, name: chosenSkill.name});
        }



        chosenSkill.source.name = (_.pluck(_.pluck(skills, 'source'), 'name')).join(', ');

        const character_skills = [];

        for (const skill of skills){
            const charactersWithSkill = await req.models.character_skill.find({skill_id: skill.id});
            character_skills.push(...charactersWithSkill);
        }

        let characters = await async.map(_.uniq(_.pluck(character_skills, 'character_id')), async (characterId) => {
            const character = await req.models.character.get(characterId);
            const user = await req.models.user.get(req.campaign.id, character.user_id);
            character.user = {
                id: user.id,
                name: user.name,
                type: user.type,
            };
            return character;
        });
        counts.total = characters.length;
        characters = characters.filter(character => {
            if (!character.active){
                counts.inactive++;

                if (!_.has(req.query, 'showInactive') || req.query.showInactive !== 'true'){
                    return false;
                }
            }
            if (character.user.type !== 'player'){
                counts.staff++;

                if (!_.has(req.query, 'showStaff') || req.query.showStaff !== 'true'){
                    return false;
                }

            }
            return true;
        });
        res.json({characters:characters, skill:chosenSkill, counts: counts});
    } catch (err){
        next(err);
    }

}

async function showCustomFieldReport(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/report', name: 'Reports'},
        ],
        current: 'Custom Field Report'
    };
    try{
        res.locals.custom_fields = await req.models.custom_field.find({campaign_id:req.campaign.id});
        const characters = await req.models.character.find({active:true, campaign_id: req.campaign.id});
        res.locals.characters = await async.map(characters, async (character) => {
            if (character.user_id){
                character.user = await req.models.user.get(req.campaign.id, Number(character.user_id));
            }
            character.custom_fields = await req.models.character_custom_field.find({character_id:character.id});

            return character;
        });
        res.locals.csrfToken = req.csrfToken();
        res.render('report/custom_field', { pageTitle: 'Custom Field Report' });
    } catch (err){
        next(err);
    }
}

async function showSourceReport(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/report', name: 'Reports'},
        ],
        current: 'Character Source Report'
    };
    try{
        res.locals.skill_source_types = await req.models.skill_source_type.find({campaign_id:req.campaign.id});
        res.locals.skill_sources = await req.models.skill_source.find({campaign_id:req.campaign.id});
        const characters = await req.models.character.find({active:true, campaign_id: req.campaign.id});
        res.locals.characters = await async.map(characters, async (character) => {
            if (character.user_id){
                character.user = await req.models.user.get(req.campaign.id, Number(character.user_id));
            }
            character.sources = await req.models.character_skill_source.find({character_id:character.id});

            return character;
        });
        res.locals.csrfToken = req.csrfToken();
        res.render('report/source', { pageTitle: 'Character Source Report' });
    } catch (err){
        next(err);
    }
}

const router = express.Router();

router.use(permission('contrib'));
router.use(function(req, res, next){
    res.locals.siteSection='gm';
    next();
});

router.get('/',csrf(), list);
router.get('/group', csrf(), showGroupReport);
router.get('/group/data', csrf(), getGroupReportData);
router.get('/skill', csrf(), showSkillReport);
router.get('/skill/skills', csrf(), getSkillReportSkills);
router.get('/skill/data', csrf(), getSkillReportData);
router.get('/custom_field', csrf(), showCustomFieldReport);
router.get('/source', csrf(), showSourceReport);

export default router;
