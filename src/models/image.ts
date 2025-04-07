'use strict';
import _ from 'underscore';

import Model from  '../lib/Model';
import uploadHelper from '../lib/uploadHelper';

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
    postSelect: postProcess,
    postSave: postSave
});

async function postProcess(image:ModelData){
    image.upload = await models.upload.get(image.upload_id);
    image.thumbnailUrl = uploadHelper.getUrl(image.upload as ImageModel, {thumbnail:true});
    return image;
}

async function postSave(id, data){
    if (_.has(data, 'upload') && data.upload_id){
        const upload = await models.upload.get(data.upload_id);
        for (const field of ['display_name', 'description']){
            if (_.has(data.upload, field)){
                upload[field] = data.upload[field];
            }
        }
        await models.upload.update(upload.id, upload);
    }
}

export = Image;
