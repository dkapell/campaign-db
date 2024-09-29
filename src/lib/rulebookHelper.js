'use strict';
const config = require('config');
const _ = require('underscore');
const Drive = require('./Drive');
const models = require('./models');

exports.display = async function(campaignId){
    const rulebooks = await models.rulebook.find({campaign_id:campaignId});

    const output = [];


    for (const rulebook of rulebooks){

        const rulebookData = {
            children: [],
            files: []
        };

        const rulebookExcludes = rulebooks[0].excludes;

        for (const child of rulebook.data.children){
            if (!_.has(rulebookExcludes, child.id)){
                rulebookData.children.push(child);
            }
        }
        for (const file of rulebook.data.files){
            if (!_.has(rulebookExcludes, file.id)){
                rulebookData.files.push(file);
            }
        }

        output.push({name: rulebook.name, rulebook:rulebookData});
    }

    return output;
};

exports.generate = async function generate(rulebookId){
    const rulebook = await models.rulebook.get(rulebookId);
    if (!rulebook.drive_folder){
        return;
    }
    rulebook.data = await Drive.listAll(rulebook.drive_folder, null, true);
    rulebook.generated = new Date();
    return models.rulebook.update(rulebookId, rulebook);
};
