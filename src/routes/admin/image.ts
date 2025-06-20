import express from 'express';
import _ from 'underscore';
import permission from '../../lib/permission';
import uploadHelper from '../../lib/uploadHelper';

/* GET images listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Images'
    };
    try {
        const images = await req.models.image.find({campaign_id: req.campaign.id, for_cms:true});
        res.locals.imageCounts = _.countBy(images, 'type');
        res.locals.images = images.sort(uploadHelper.sorter);
        res.render('admin/image/list', { pageTitle: 'Images' });
    } catch (err){
        next(err);
    }
}

async function listApi (req, res, next){
    try {
        let images = await req.models.image.find({campaign_id: req.campaign.id, for_cms:true});
        if (req.query.type){
            images = images.filter(image => {
                return image.type === req.query.type;
            });
        }
        images = images.sort(uploadHelper.sorter);
        res.json(images);
    } catch (err){
        next(err);
    }
}

function showNew(req, res){
    res.locals.image = {
        upload: {
            display_name: null,
            description:null
        },
        type: 'content',
        display_to_pc:true
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/admin/image', name: 'Images'},
        ],
        current: 'New'
    };
    if (_.has(req.session, 'imageData')){
        res.locals.image = req.session.imageData;
        delete req.session.imageData;
    }
    res.render('admin/image/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;

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
                { url: '/admin/image', name: 'Images'},
            ],
            current: 'Edit: ' + image.upload.name
        };

        res.render('admin/image/edit');
    } catch(err){
        next(err);
    }
}

async function update(req, res){
    const id = req.params.id;
    const image = req.body.image;
    req.session.imageData = image;

    for (const field of ['display_to_pc']){
        if (!_.has(image, field)){
            image[field] = false;
        }
    }

    try {
        const current = await req.models.image.get(id);
        if (!current){
            throw new Error('Invalid Image');
        }
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }


        image.upload_id = current.upload_id;
        await req.models.image.update(id, image);
        delete req.session.imageData;
        const upload = await req.models.upload.get(current.upload_id);
        req.flash('success', 'Updated Image ' + upload.name);
        res.redirect('/admin/image');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/admin/image/'+id));

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
        await req.models.upload.delete(current.upload_id);
        const bucket = uploadHelper.getBucket(current.upload);
        await uploadHelper.remove(bucket, uploadHelper.getKey(current.upload));
        await uploadHelper.remove(bucket, uploadHelper.getKey(current.upload, {thumbnail:true}));
        req.flash('success', 'Removed Image');
        res.redirect('/admin/image');
    } catch(err) {
        return next(err);
    }
}

async function signS3(req, res, next){

    const fileName = decodeURIComponent(req.query.filename);
    const fileType = decodeURIComponent(req.query.filetype);
    const imageType = decodeURIComponent(req.query.imagetype);

    if (!fileType.match(/^image/)){
        return res.json({success:false, error: 'invalid file type'});
    }
    const upload = await req.upload.makeEmptyUpload(fileName, 'image', imageType !== 'gallery');

    const image = {
        id: null,
        upload_id: upload.id,
        campaign_id: req.campaign.id,
        upload: upload,
        for_cms: true
    };

    image.id = await req.models.image.create(image);
    const key = uploadHelper.getKey(image.upload);
    try{
        const signedRequest = await uploadHelper.signS3(key, fileType, upload.is_public);
        res.json({
            success:true,
            data: {
                signedRequest: signedRequest,
                url: uploadHelper.getUrl(image.upload),
                objectId: image.id,
                postUpload: {
                    url: `/admin/upload/${image.upload.id}/uploaded`,
                    csrf: res.locals.csrfToken
                }
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
router.get('/', list);
router.get('/list', listApi);
router.get('/new', showNew);
router.get('/sign-s3', signS3);
router.get('/:id', showEdit);
router.put('/:id', update);
router.delete('/:id', permission('admin'), remove);

export default router;
