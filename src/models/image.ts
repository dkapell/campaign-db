'use strict';
import _ from 'underscore';
import validator from 'validator';

import Model from  '../lib/Model';
import imageHelper from '../lib/imageHelper';

import uploadModel from './upload';

const models = {
    upload: uploadModel
}

const tableFields = [
    'id',
    'upload_id',
    'campaign_id',
    'type',
    'width',
    'height',
    'for_cms'
];

const Image = new Model('images', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: postProcess,
    postSave: postSave
});

function validate(data){
    if (_.has(data, 'name') && ! validator.isLength(data.name, {min:2, max:80})){
        return false;
    }
    return true;
}

async function postProcess(image:ModelData){
    image.upload = await models.upload.get(image.upload_id);
    image.thumbnailUrl = imageHelper.getThumbnailUrl(image as ImageModel);
    return image;
}

async function postSave(id, data){
    if (_.has(data, 'upload') && data.upload_id){
        const upload = await models.upload.get(data.upload_id);
        for (const field of ['display_name', 'description', 'size', 'status']){
            if (_.has(data.upload, field)){
                upload[field] = data.upload[field];
            }
        }
        await models.upload.update(upload.id, upload);
    }
}

export default Image;
