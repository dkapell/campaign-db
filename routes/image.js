const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const config = require('config');
const permission = require('../lib/permission');
const imageHelper = require('../lib/imageHelper');

/* GET images listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Images'
    };
    try {
        const images = await req.models.image.find({campaign_id: req.campaign.id});
        res.locals.imageCounts = _.countBy(images, 'type');
        res.locals.images = images;
        res.render('image/list', { pageTitle: 'Images' });
    } catch (err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.image = {
        display_name: null,
        description:null
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/image', name: 'Images'},
        ],
        current: 'New'
    };
    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'imageData')){
        res.locals.image = req.session.imageData;
        delete req.session.imageData;
    }
    res.render('image/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const image = await req.models.image.get(id);
        if (!image || image.campaign_id !== req.campaign.id){
            throw new Error('Invalid Image');
        }
        res.locals.image = image;
        if (_.has(req.session, 'imageData')){
            res.locals.image = req.session.imageData;
            delete req.session.imageData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/image', name: 'Images'},
            ],
            current: 'Edit: ' + image.name
        };

        res.render('image/edit');
    } catch(err){
        next(err);
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const image = req.body.image;
    req.session.imageData = image;

    try {
        const current = await req.models.image.get(id);
        if (!current){
            throw new Error('Invalid Image');
        }
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        await req.models.image.update(id, image);
        delete req.session.imageData;
        req.flash('success', 'Updated Image ' + image.name);
        res.redirect('/image');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/image/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;

    try {
        const current = await req.models.image.get(id);
        if (!current){
            throw new Error('Invalid Image');
        }

        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.image.delete(id);
        await imageHelper.remove(imageHelper.getKey(current));
        req.flash('success', 'Removed Image');
        res.redirect('/image');
    } catch(err) {
        return next(err);
    }
}

async function signS3(req, res, next){

    const fileName = decodeURIComponent(req.query.filename);
    const fileType = decodeURIComponent(req.query.filetype);

    if (!fileType.match(/^image/)){
        return res.json({success:false, error: 'invalid file type'});
    }

    const image = {
        name: fileName,
        campaign_id: req.campaign.id
    };

    image.id = await req.models.image.create(image);

    const key = imageHelper.getKey(image);

    try{
        const signedRequest = await imageHelper.signS3(key, fileType);
        res.json({
            success:true,
            data: {
                signedRequest: signedRequest,
                url: imageHelper.getUrl(image),
                imageId: image.id
            }
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
router.get('/', list);
router.get('/new', csrf(), showNew);
router.get('/sign-s3', csrf(), signS3);
router.get('/:id', csrf(), showEdit);
router.put('/:id', csrf(), update);
router.delete('/:id', permission('admin'), remove);

module.exports = router;
