'use strict';
const _ = require('underscore');
const validator = require('validator');

const Model = require('../lib/Model');
const imageHelper = require('../lib/imageHelper');

const tableFields = ['id', 'campaign_id', 'name', 'display_name', 'description', 'status', 'type', 'size', 'width', 'height'];

const Image = new Model('images', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: postProcess
});

module.exports = Image;

function validate(data){
    if (_.has(data, 'name') && ! validator.isLength(data.name, 2, 80)){
        return false;
    }
    return true;
}

async function postProcess(image){
    image.url = imageHelper.getUrl(image);
    image.thumbnailUrl = imageHelper.getThumbnailUrl(image);
    image.sizePrint = prettyPrintSize(image.size);
    return image;
}

function prettyPrintSize(value, type) {
    if (!value) {
        return '0';
    }
    if (!type){
        type = 'B';
    }
    var prefixes = [ '', 'K', 'M', 'G', 'T', 'P', 'E' ];
    var index;
    for (index = 0; value >= 1024 && index < prefixes.length - 1; index++)
        value /= 1024;

    if (value > 1024 || Math.round(value) === value)
        value = Math.round(value).toString();
    else if (value < 10)
        value = value.toFixed(2);
    else
        value = value.toPrecision(4);

    value += ' ' + prefixes[index];

    if (index !== 0)
        value += type;

    return value;
}
