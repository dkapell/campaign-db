'use strict';
const validator = require('validator');
const Model = require('../lib/Model');

const tableFields = ['id', 'campaign_id', 'name', 'description', 'display_order', 'drive_folder', 'data', 'excludes', 'generated'];

const Rulebook = new Model('rulebooks', tableFields, {
    validator: validate,
    order: ['display_order']
});

module.exports = Rulebook;

function validate(data){
    if (! validator.isLength(data.name, 2, 512)){
        return false;
    }
    return true;
}
