'use strict';
import validator from 'validator';
import _ from 'underscore';
import Model from  '../lib/Model';

import fontModel from './font'
const models = {
    font: fontModel
};

const tableFields = [
    'id',
    'campaign_id',
    'doc_id', 
    'name', 
    'border', 
    'label',
    'runes_only',
    'font_id',
    'header_font_id',
    'header_font_scale',
    'body_font_id',
    'body_font_scale',
    'title_font_id',
    'title_font_scale',
    'status', 
    'updated', 
    'preview'
];

const Translation = new Model('translations', tableFields, {
    validator: validate,
    order: ['updated desc'],
    postSelect: fill
});

export = Translation;

function validate(data){
    if (_.has(data, 'name') && ! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

async function fill(record){
    if (record.font_id){
        record.font = await models.font.get(record.font_id);
    }
    return record;
}


