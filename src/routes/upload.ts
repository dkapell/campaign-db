import express from 'express';
import csrf from 'csurf';
import async from 'async';
import permission from '../lib/permission';
import uploadHelper from '../lib/uploadHelper';
import imageHelper from '../lib/imageHelper';

/* GET uploads listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Uploads'
    };
    try {
        res.locals.csrfToken = req.csrfToken();
        const uploads = await req.models.upload.find({campaign_id: req.campaign.id});
        res.locals.uploads = await async.map(uploads, async (upload) => {
            if (upload.user_id){
                upload.user = await req.models.user.get(req.campaign.id, upload.user_id);
            }
            return uploadHelper.fillUsage(upload);
        });
        res.locals.title += ' - Uploads';
        res.render('upload/list', { pageTitle: 'Uploads' });
    } catch (err){
        next(err);
    }
}



async function remove(req, res, next){
    const id = req.params.id;
    try {
        const user = req.session.activeUser;
        const current = await req.models.upload.get(id);
        if (user.type !== 'admin' && user.id !== current.id){
            throw new Error('Can not delete this record');
        }
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        const bucket = uploadHelper.getBucket(current);
        if (current.type === 'image'){
            await uploadHelper.remove(bucket, uploadHelper.getKey(current, {thumbnail:true}));
        }
        await req.models.upload.delete(id);
        await uploadHelper.remove(bucket, uploadHelper.getKey(current));
        await req.audit('upload', id, 'delete', {old: current});
        req.flash('success', 'Removed Upload and associated records');
        res.redirect('/upload');
    } catch(err) {
        return next(err);
    }
}

async function signImageS3(req, res, next){

    const fileName = decodeURIComponent(req.query.filename);
    const fileType = decodeURIComponent(req.query.filetype);
    const is_public = !!req.query.public;
    if (!fileType.match(/^image/)){
        return res.json({success:false, error: 'invalid file type'});
    }

    const upload = await req.upload.makeEmptyUpload(fileName, 'image', is_public);

    const image = {
        id: null,
        upload_id: upload.id,
        campaign_id: req.campaign.id,
        upload: upload,
        for_cms: false
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
                postUpload: `/upload/${image.upload.id}/uploaded`
            },
        });
    }
    catch (err) {
        return next(err);
    }
}

async function markUploadedApi(req, res){
    const id = req.params.id;
    try{
        const upload = await req.models.upload.get(id);
        if (!upload){
            return req.json({success:false, error: 'Invalid Upload'});
        }
        if (upload.campaign_id !== req.campaign.id){
            return req.json({success:false, error: 'Can not update record from different campaign'});
        }
        upload.status = 'ready';
        upload.size = await uploadHelper.getSize(upload);
        await req.models.upload.update(upload.id, upload);
        if (upload.type === 'image'){
            const image = await req.models.image.findOne({upload_id: id});
            if (!image.height || ! image.width){
                console.log('getting metadata for ' + uploadHelper.getKey(upload));
                try {
                    const details = await imageHelper.getImageDetails(image);
                    if (details){
                        image.width = details.width;
                        image.height = details.height;
                    }

                    await req.models.image.update(image.id, image);
                    await imageHelper.buildThumbnail(image);

                } catch (err){
                    console.error(err);
                    console.log(`unsupported image format for ${image.id}:${image.upload.name}`);
                }
            }

        }
        return res.json({success:true});
    } catch (err){
        console.trace(err);
        res.json({success:false, error:err.message});
    }
}

async function getUpload(req, res, next){
    const id = req.params.id;
    const thumbnail = req.query.thumbnail;
    try{
        const user = req.session.activeUser;
        let upload = await req.models.upload.get(id);

        if (upload.campaign_id !== req.campaign.id){
            throw new Error('Can not access record from different campaign');
        }

        // Only allow Contrib+, reg viewer and self to access uploads.
        if (!res.locals.checkPermission('contrib, registration view') && user.id !== upload.user_id){
            throw new Error('Can not access this record');
        }


        if (!res.locals.checkPermission('contrib') && user.id !== upload.user_id){
            // Registration View only
            upload = await uploadHelper.fillUsage(upload);

            if (upload.usedFor.type !== 'registration'){
                throw new Error('Can not access this record');
            }
            // Insert new permissions to check here
        }

        const options = {
            thumbnail: !!thumbnail
        };
        if (upload.is_public){
            return res.redirect(uploadHelper.getUrl(upload, options));
        }
        const uploadStream = uploadHelper.getStream(upload, options);
        uploadStream.pipe(res);
    } catch (err){
        next(err);
    }
}

const router = express.Router();

router.use(permission('login'));
router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.get('/', csrf(), permission('admin'), list);
router.get('/sign-image', signImageS3);
router.get('/:id', getUpload);
router.put('/:id/uploaded', markUploadedApi)
router.delete('/:id', remove);

export default router;
