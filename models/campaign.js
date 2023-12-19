'use strict';
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const Model = require('../lib/Model');

const tableFields = ['id', 'name', 'description', 'site', 'theme', 'css', 'created_by', 'created', 'updated', 'default_to_player', 'display_map', 'staff_drive_folder', 'npc_drive_folder', 'player_drive_folder', 'google_client_id', 'google_client_secret', 'display_glossary'];

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
