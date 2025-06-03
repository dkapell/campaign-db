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
    'for_cms',
    'display_to_pc'
];

const Image = new Model('images', tableFields, {
    postSelect: postProcess,
    postSave: postSave
});

async function postProcess(image:ModelData){
    const upload = await models.upload.get(image.upload_id);
    image.upload = upload;
    image.thumbnailUrl = uploadHelper.getUrl(upload as UploadModel, {thumbnail:true});
    image.name = upload.display_name?upload.display_name:upload.name;
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
