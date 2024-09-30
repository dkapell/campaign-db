'use strict';
import validator from 'validator';
import Model from  '../lib/Model';

import imageModel from './image';

const models = {
    image: imageModel
};

const tableFields = [
    'id',
    'campaign_id',
    'uuid',
    'name',
    'description',
    'status',
    'display_to_pc',
    'image_id'
];

const skipAuditFields = [
    'uuid',
    'status'
];

const Map = new Model('maps', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: fill,
    skipAuditFields: skipAuditFields
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

async function fill(record){
    if (record.image_id){
        record.image = await models.image.get(record.image_id);
    } else {
        record.image = null;
    }
    return record;
}

export = Map;
