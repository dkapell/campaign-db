'use strict';
import _ from 'underscore';
import validator from 'validator';

import Model from  '../lib/Model';
import imageHelper from '../lib/imageHelper';

const tableFields = ['id', 'campaign_id', 'name', 'display_name', 'description', 'status', 'type', 'size', 'width', 'height'];

const Image = new Model('images', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: postProcess
});

function validate(data){
    if (_.has(data, 'name') && ! validator.isLength(data.name, {min:2, max:80})){
        return false;
    }
    return true;
}

async function postProcess(image:ModelData){
    image.url = imageHelper.getUrl(image as ImageModel);
    image.thumbnailUrl = imageHelper.getThumbnailUrl(image as ImageModel);
    image.sizePrint = prettyPrintSize((image.size as number));
    return image;
}

function prettyPrintSize(value:number, type?:string):string {
    if (!value) {
        return '0';
    }
    if (!type){
        type = 'B';
    }
    const prefixes = [ '', 'K', 'M', 'G', 'T', 'P', 'E' ];
    let index = 0;
    for (index = 0; value >= 1024 && index < prefixes.length - 1; index++)
        value /= 1024;

    if (value > 1024 || Math.round(value) === value)
        value = Math.round(value);
    else if (value < 10)
        value = Number(value.toFixed(2));
    else
        value = Number(value.toPrecision(4));

    const output = `${value} ${prefixes[index]}`;

    if (index !== 0)
        return `${output}${type}`;

    return output;
}

export = Image;
