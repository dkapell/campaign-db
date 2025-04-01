import async from 'async';
import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import permission from '../lib/permission';
import surveyHelper from '../lib/surveyHelper';

/* GET surveys listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Surveys'
    };
    try {
        res.locals.csrfToken = req.csrfToken();
        res.locals.surveys = await req.models.survey.find({campaign_id:req.campaign.id});
        res.locals.title += ' - Surveys';
        res.render('survey/list', { pageTitle: 'Surveys' });
    } catch (err){
        next(err);
    }
}


async function show(req, res, next){
    const id = req.params.id;
    try{
        const survey = await req.models.survey.get(id);
        if (!survey || survey.campaign_id !== req.campaign.id){
            throw new Error('Invalid Survey');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/survey', name: 'Surveys'}
            ],
            current: survey.name
        };
        res.locals.survey = survey;
        res.locals.title += ` - Survey - ${survey.name}`;
        res.render('survey/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        if (req.query.clone){
            const survey = await req.models.survey.get(req.query.clone);
            if (!survey || survey.campaign_id !== req.campaign.id){
                throw new Error('Invalid Survey');
            }
            delete survey.id;
            survey.is_default = false;
            survey.name += ' (Copy)';
            res.locals.survey = survey;

            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/survey', name: 'Surveys'},
                ],
                current: `Clone: ${survey.name}`
            };
        } else {
            res.locals.survey = {
                name: null,
                type: null,
                is_default: false,
                definition: []
            };

            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/survey', name: 'Surveys'},
                ],
                current: 'New'
            };
        }

        res.locals.csrfToken = req.csrfToken();

        if (_.has(req.session, 'surveyData')){
            res.locals.survey = req.session.surveyData;
            delete req.session.surveyData;
        }
        res.locals.title += ' - New Survey';
        res.render('survey/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const survey = await req.models.survey.get(id);
        if (!survey || survey.campaign_id !== req.campaign.id){
            throw new Error('Invalid Survey');
        }
        res.locals.survey = survey;
        if (_.has(req.session, 'surveyData')){
            res.locals.survey = req.session.surveyData;
            delete req.session.surveyData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/survey', name: 'Surveys'},
            ],
            current: 'Edit: ' + survey.name
        };
        res.locals.title += ` - Edit Survey - ${survey.name}`;
        res.render('survey/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const survey = req.body.survey;

    req.session.surveyData = survey;
    for (const field of ['is_default']){
        if (!_.has(survey, field)){
            survey[field] = false;
        }
    }

    survey.campaign_id = req.campaign.id;

    try{

        survey.definition = JSON.stringify(surveyHelper.parseFields(survey.definition));

        if (survey.is_default && survey.type !== 'other'){
            const surveys = await req.models.survey.find({campaign_id:req.campaign.id, type: survey.type});
            await async.each(surveys, async function(existingSurvey: ModelData){
                if (existingSurvey.is_default){
                    existingSurvey.is_default = false;
                    return req.models.survey.update(existingSurvey.id, existingSurvey);
                }
            });
        }

        const id = await req.models.survey.create(survey);
        await req.audit('survey', id, 'create', {new:survey});
        delete req.session.surveyData;
        req.flash('success', 'Created Survey ' + survey.name);
        res.redirect('/survey');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/survey/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const survey = req.body.survey;
    req.session.surveyData = survey;
    for (const field of ['is_default']){
        if (!_.has(survey, field)){
            survey[field] = false;
        }
    }

    try {
        const current = await req.models.survey.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        console.log('here1')
        survey.definition = JSON.stringify(surveyHelper.parseFields(survey.definition));

        console.log('here2')

         if (!current.is_default && survey.is_default && survey.type !== 'other'){
            const surveys = await req.models.survey.find({campaign_id:req.campaign.id, type: survey.type});
            await async.each(surveys, async function(existingSurvey: ModelData){
                if (existingSurvey.id !== id && existingSurvey.is_default){
                    existingSurvey.is_default = false;
                    return req.models.survey.update(existingSurvey.id, existingSurvey);
                }
            });
        }


        await req.models.survey.update(id, survey);
        await req.audit('survey', id, 'update', {old: current, new:survey});
        delete req.session.surveyData;
        req.flash('success', 'Updated Survey ' + survey.name);
        res.redirect('/survey');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/survey/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.survey.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.survey.delete(id);
        await req.audit('survey', id, 'delete', {old: current});
        req.flash('success', 'Removed Survey');
        res.redirect('/survey');
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

router.get('/', csrf(), list);
router.get('/new', csrf(), showNew);
router.get('/:id', csrf(), show);
router.get('/:id/edit', csrf(),showEdit);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.delete('/:id', remove);

export default router;
