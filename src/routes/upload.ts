import express from 'express';
import csrf from 'csurf';
import async from 'async';
import permission from '../lib/permission';

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
        const uploads = await req.models.upload.find({campaign_id:req.campaign.id});

        res.locals.uploads = await async.map(uploads, async (upload) => {
            if (upload.user_id){
                upload.user = await req.models.user.get(req.campaign.id, upload.user_id);
            }
            switch (upload.type){
                case 'image': {
                    const image = await req.models.image.findOne({upload_id:upload.id});
                    if (image){
                        upload.image = image;
                    }
                    break;
                }
            }
            return upload;
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
        const current = await req.models.upload.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.upload.delete(id);
        await req.audit('upload', id, 'delete', {old: current});
        req.flash('success', 'Removed Upload and associated records');
        res.redirect('/upload');
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
router.delete('/:id', remove);

export default router;
