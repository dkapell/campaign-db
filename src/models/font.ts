'use strict';
import _ from 'underscore';

import Model from  '../lib/Model';

import uploadModel from './upload';

const models = {
    upload: uploadModel
}

const tableFields = [
    'id',
    'campaign_id',
    'upload_id',
    'type',
    'name',
    'size',
    'vertical'
];

const Font = new Model('fonts', tableFields, {
    postSelect: postProcess,
    postSave: postSave,
    order: ['name']
});

async function postProcess(record:ModelData){
    if (record.upload_id){
        record.upload = await models.upload.get(record.upload_id);
    }
    return record;
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

export = Font;
