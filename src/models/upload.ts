'use strict';
import _ from 'underscore';
import validator from 'validator';

import Model from  '../lib/Model';
import uploadHelper from '../lib/uploadHelper';

const tableFields = [
    'id', 
    'upload_id',
    'user_id',
    'campaign_id', 
    'name', 
    'display_name', 
    'description', 
    'status',
    'is_public',
    'permission',
    'type', 
    'size',
    'created'
];

const Upload = new Model('uploads', tableFields, {
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

async function postProcess(record:ModelData){
    record.url = uploadHelper.getUrl(record as ImageModel);
    record.sizePrint = prettyPrintSize((record.size as number));
    return record;
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

export = Upload;
