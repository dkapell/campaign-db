'use strict';
const validator = require('validator');
const Model = require('../lib/Model');

const models = {
    image: require('./image')
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

const Map = new Model('maps', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: fill
});

module.exports = Map;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
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
