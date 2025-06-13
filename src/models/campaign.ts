'use strict';
import validator from 'validator';
import config from 'config';
import _ from 'underscore';
import cache from '../lib/cache';

import Model from '../lib/Model';
import pluralize from 'pluralize';


import imageModel from './image';
import documentationModel from './documentation';

const models = {
    image: imageModel,
    documentation: documentationModel
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
    'display_translations',
    'display_skill_doc',
    'staff_drive_folder',
    'npc_drive_folder',
    'player_drive_folder',
    'google_client_id',
    'google_client_secret',
    'display_glossary',
    'display_gallery',
    'display_schedule',
    'body_font',
    'header_font',
    'menu_dark',
    'cp_base',
    'cp_cap',
    'cp_factor',
    'cp_approval',
    'cp_requests',
    'event_default_cost',
    'event_default_location',
    'timezone',
    'user_type_map',
    'post_event_survey_cp',
    'post_event_survey_hide_days',
    'event_attendance_cp',
    'rename_map',
    'translation_drive_folder',
    'default_translation_header_font_id',
    'default_translation_body_font_id',
    'default_translation_title_font_id',
    'character_sheet_title_font_id',
    'character_sheet_header_font_id',
    'character_sheet_body_font_id',
    'character_sheet_title_font_scale',
    'character_sheet_header_font_scale',
    'character_sheet_body_font_scale',
    'translation_scale',
    'player_gallery',
    'stripe_account_id',
    'stripe_account_ready',
    'schedule_users'
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
    data.renames = buildRenameMap(data.rename_map as Record<string, string>);

    data.documentations = await models.documentation.find({campaign_id:Number(data.id)});
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

function buildRenameMap(rename_map:Record<string, string>){
    const renames = {};
    if (rename_map){
        for (const name in rename_map as Record<string, string>){
            renames[name] = buildRename(rename_map[name]);
        }
    }
    const defaultRenames: Record<string, string> = config.get('renames');
    for (const name in defaultRenames){
        if (!_.has(rename_map, name)){
            renames[name] = buildRename(defaultRenames[name]);
        }
    }
    return renames;
}

function buildRename(input:string){
    const doc = {
        singular: input,
        plural: pluralize(input)
    }
    if (input.match(/^[A-Z]+$/)){
        doc.plural = `${input}s`;
    }
    return doc;
}

export = Campaign;
