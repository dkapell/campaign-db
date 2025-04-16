import express from 'express';
import csrf from 'csurf';
import _ from 'underscore';
import permission from '../../lib/permission';
import uploadHelper from '../../lib/uploadHelper';
import fontHelper from '../../lib/fontHelper';

/* GET fonts listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Fonts'
    };
    try {
        res.locals.fonts = await req.models.font.find({campaign_id: req.campaign.id});
        res.locals.csrfToken = req.csrfToken();
        res.render('font/list', { pageTitle: 'Fonts' });
    } catch (err){
        next(err);
    }
}

async function listApi (req, res, next){
    try {
        const fonts = await req.models.font.find({campaign_id: req.campaign.id});
        res.json(fonts);
    } catch (err){
        next(err);
    }
}

async function showNew(req, res, next){
    try {
        res.locals.font = {
            name: null,
            type: 'google',
            size: 24,
            vertical: false,
            lettersonly: false,
            transformation: 'none',
            language: null,
            upload: {
                display_name: null,
                description:null,
            }
        };
        res.locals.googleFonts = await fontHelper.list()
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/font', name: 'Fonts'},
            ],
            current: 'New'
        };
        res.locals.csrfToken = req.csrfToken();
        if (_.has(req.session, 'fontData')){
            res.locals.font = req.session.fontData;
            delete req.session.fontData;
        }
        res.render('font/new');
    } catch(err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const font = await req.models.font.get(id);
        if (!font || font.campaign_id !== req.campaign.id){
            throw new Error('Invalid Font');
        }
        res.locals.font = font;
        if (_.has(req.session, 'fontData')){
            res.locals.font = req.session.fontData;
            delete req.session.fontData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/font', name: 'Fonts'},
            ],
            current: 'Edit: ' + font.name
        };
        res.locals.googleFonts = await fontHelper.list()
        res.render('font/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const font = req.body.font;

    req.session.fontData = font;
    for (const field of ['vertical', 'lettersonly']){
        if (!_.has(font, field)){
            font[field] = false;
        }
    }
    font.campaign_id = req.campaign.id;
    try{
        if (font.type === 'google'){
            font.name = font.googleName;
        }
        const id = await req.models.font.create(font);
        await req.audit('font', id, 'create', {new:font});
        delete req.session.pageData;
        req.flash('success', 'Created Font ' + font.name);
        res.redirect('/font');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/font/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const font = req.body.font;
    req.session.fontData = font;

    try {
        const current = await req.models.font.get(id);
        if (!current){
            throw new Error('Invalid Font');
        }
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        font.upload_id = current.upload_id;
        await req.models.font.update(id, font);
        delete req.session.fontData;
        req.flash('success', 'Updated Font ' + font.name);
        res.redirect('/font');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/font/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;

    try {
        const current = await req.models.font.get(id);
        if (!current){
            throw new Error('Invalid Font');
        }

        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.upload.delete(current.upload_id);
        const bucket = uploadHelper.getBucket(current.upload);
        await uploadHelper.remove(bucket, uploadHelper.getKey(current.upload));
        req.flash('success', 'Removed Font');
        res.redirect('/font');
    } catch(err) {
        return next(err);
    }
}

async function signS3(req, res, next){

    const fileName = decodeURIComponent(req.query.filename);
    const fileType = decodeURIComponent(req.query.filetype);

    if (!fileType.match(/^font/)){
        return res.json({success:false, error: 'invalid file type'});
    }
    const upload = await req.upload.makeEmptyUpload(fileName, 'font', false);

    const font = {
        id: null,
        upload_id: upload.id,
        campaign_id: req.campaign.id,
        upload: upload,
        type: 'user'
    };

    font.id = await req.models.font.create(font);
    const key = uploadHelper.getKey(font.upload);
    try{
        const signedRequest = await uploadHelper.signS3(key, fileType, upload.is_public);
        res.json({
            success:true,
            data: {
                signedRequest: signedRequest,
                url: uploadHelper.getUrl(font.upload),
                objectId: font.id,
                postUpload: `/upload/${font.upload.id}/uploaded`
            },
        });
    }
    catch (err) {
        return next(err);
    }
}

const router = express.Router();

router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.use(permission('gm'));
router.get('/', csrf(), list);
router.get('/list', listApi);
router.get('/new', csrf(), showNew);
router.get('/sign-s3', csrf(), signS3);
router.get('/:id', csrf(), showEdit);
router.get('/:id/edit', csrf(), showEdit);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.delete('/:id', permission('admin'), remove);

export default router;
