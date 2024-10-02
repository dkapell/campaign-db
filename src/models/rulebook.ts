'use strict';
import validator from 'validator';
import Model from  '../lib/Model';

const tableFields = ['id', 'campaign_id', 'name', 'description', 'display_order', 'drive_folder', 'data', 'excludes', 'generated'];
const skipAuditFields = [ 'data', 'generated'];

const Rulebook = new Model('rulebooks', tableFields, {
    validator: validate,
    order: ['display_order'],
    skipAuditFields:skipAuditFields
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

export = Rulebook;
