'use strict';
import validator from 'validator';
import cache from '../lib/cache';

import Model from '../lib/Model';

import imageModel from './image';

const models = {
    image: imageModel
};

interface CampaignModel extends IModel {
   getBySite?: (site:string) => Promise<ModelData>
}

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
    'display_cp',
    'staff_drive_folder',
    'npc_drive_folder',
    'player_drive_folder',
    'google_client_id',
    'google_client_secret',
    'display_glossary',
    'body_font',
    'header_font',
    'menu_dark',
    'cp_base',
    'cp_cap',
    'cp_factor',
    'cp_approval',
    'event_default_cost',
    'event_default_location',
    'timezone',
    'user_type_map',
    'post_event_survey_cp',
    'post_event_survey_hide_days',
    'event_attendance_cp'
];

const Campaign: CampaignModel = new Model('campaigns', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: postSelect,
    postSave: postSave,
    postDelete: postSave
});

Campaign.getBySite = async function getBySite(site:string): Promise<ModelData>{
    const record = await cache.check('campaign-site', site);
    if (record) {
        return record;
    }
    const ret = await this.findOne({site:site});
    return ret;
};

async function postSelect(data:ModelData){
    if (data.image_id){
        data.image = await models.image.get(data.image_id);
    }
    if (data.favicon_id){
        data.favicon = await models.image.get(data.favicon_id);
    }
    if (data.site){
        await cache.store('campaign-site', (data.site as string), data);
    }
    return data;
}

async function postSave(id:number, data:ModelData):Promise<void>{
    if (data.site){
        await cache.invalidate('campaign-site', (data.site as string));
    }
    return;
}

function validate(data:ModelData){
    if (! validator.isLength(''+data.name, {min:2, max:255})){
        return false;
    }
    return true;
}

export = Campaign;
