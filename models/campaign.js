'use strict';
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const Model = require('../lib/Model');
const models = {
    image: require('./image')
};

const tableFields = [
    'id',
    'name',
    'description',
    'site',
    'image_id',
    'favicon_id',
    'theme',
    'css',
    'created_by',
    'created',
    'updated',
    'default_site',
    'default_to_player',
    'display_map',
    'staff_drive_folder',
    'npc_drive_folder',
    'player_drive_folder',
    'google_client_id',
    'google_client_secret',
    'display_glossary',
    'body_font',
    'header_font',
    'menu_dark'
];

const Campaign = new Model('campaigns', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: postSelect,
    postSave: postSave,
    postDelete: postSave
});

Campaign.getBySite = async function getBySite(site){
    const self = this;
    let record = await cache.check('campaign-site', site);
    if (record) {
        return record;
    }
    return self.findOne({site:site});
};

module.exports = Campaign;

async function postSelect(data){
    if (data.image_id){
        data.image = await models.image.get(data.image_id);
    }
    if (data.favicon_id){
        data.favicon = await models.image.get(data.favicon_id);
    }
    await cache.store('campaign-site', data.site, data);
    return data;
}

async function postSave(id, data){
    if (data.site){
        return cache.invalidate('campaign-site', data.site);
    }
}

function validate(data){
    if (! validator.isLength(data.name, 2, 255)){
        return false;
    }
    return true;
}
