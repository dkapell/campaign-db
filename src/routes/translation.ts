import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import permission from '../lib/permission';
import Drive from '../lib/Drive';
import pdfLayout from '../lib/renderer/translation';
import async from 'async';


/* GET translations listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Translations'
    };
    try {

        const files = await Drive.listFiles(req.campaign.translation_drive_folder);

        res.locals.translations = await async.map(files, async file => {
            const records = await req.models.translation.find({doc_id: file.id});
            if (records.length){
                const record = records[0];
                if (record.name !== file.name){
                    record.name = file.name;
                    await req.models.translation.update(record.id, record);
                }
                return record;
            } else {
                const id = await req.models.translation.create({
                    doc_id: file.id,
                    campaign_id: req.campaign.id,
                    name: file.name,
                    status: 'new',
                    title_font_id: req.campaign.default_translation_title_font_id,
                    body_font_id: req.campaign.default_translation_body_font_id,
                    header_font_id: req.campaign.default_translation_header_font_id,
                    body_font_scale: 1,
                    header_font_scale: 1
                });
                return req.models.translation.get(id);
            }
        });
        res.locals.csrfToken = req.csrfToken();
        res.locals.title += ' - Translations';
        res.render('translation/list', { pageTitle: 'Translations' });
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const translation = await req.models.translation.get(id);
        const text = await Drive.getTextWithFormatting( translation.doc_id );

        res.locals.translation = translation;

        if (_.has(req.session, 'translationData')){
            res.locals.translation = req.session.translationData;
            delete req.session.translationData;
        }
        res.locals.translation.previewText = _.pluck(text[translation.preview], 'content').join('');
        res.locals.translation.allText = text.map(paragraph => {
            return _.pluck(paragraph, 'content').join('');
        });

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/translation', name: 'Translations'},
            ],
            current: 'Edit Translation: ' + translation.name
        };
        res.locals.fonts = await req.models.font.find({campaign_id:req.campaign.id, type:'user'});
        res.locals.textFonts = await req.models.font.find({campaign_id:req.campaign.id, type:'google'});
        res.locals.title += ` - Edit Translation - ${translation.name}`;
        res.render('translation/edit');
    } catch(err){
        next(err);
    }
}

async function update(req, res){
    const id = req.params.id;
    const translation = req.body.translation;
    req.session.translationData = translation;

    for (const field of ['border', 'label', 'runes_only']){
        if (!_.has(translation, field)){
            translation[field] = false;
        }
    }

    translation.status = 'ready';
    
    try {
        const current = await req.models.translation.get(id);

        await req.models.translation.update(id, translation);
        delete req.session.translationData;
        req.flash('success', `Updated ${current.name}`);
        res.redirect('/translation');
        await pdfLayout(id);
    } catch(err) {
        console.trace(err);
        req.flash('error', err.toString());
        return (res.redirect(`/translation/${id}/edit`));
    }
}

async function renderFile(req, res){
    const id = req.params.id;
    try{
        await pdfLayout(id);
        res.json({success:true});
    } catch (err){
        res.json({success:false, error: err});
    }
}


const router = express.Router();

router.use(permission('gm'));
router.use(function(req, res, next){
    if (!req.campaign.display_translations){
        req.flash('danger', 'Translations are not active on this campaign')
        return res.redirect('/');
    }
    if (!req.campaign.translation_drive_folder){
        req.flash('danger', 'The Translation Drive Folder is not configured for this campaign')
        return res.redirect('/');
    }
    res.locals.siteSection='worldbuilding';
    next();
});

router.get('/', csrf(),list);
router.get('/:id', csrf(), showEdit);
router.get('/:id/edit', csrf(),showEdit);
router.put('/:id', csrf(), update);
router.put('/:id/render', csrf(), renderFile);

export default router;
