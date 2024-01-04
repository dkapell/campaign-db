'use strict';
const config = require('config');
const async = require('async');
const _ = require('underscore');
const models = require('./models');
const Character = require('./Character');
const campaignHelper = require('./campaignHelper');

exports.data = async function data(characterList, campaignId){
    const characterData = await async.map(characterList, async (characterId) => {
        const character = new Character({id:characterId});
        await character.init();
        if (character._data.campaign_id !== campaignId){
            throw new Error('invalid character');
        }
        return character.data();
    });

    return aggregateCharacterData(characterData, campaignId);
};

async function aggregateCharacterData(data, campaignId){
    const output = {
        attributes:[],
        cp:[],
        skills: {},
        characters: [],
        traits: {},
        languages: {},
        diagnose: {},
        styles: {}
    };
    if (!data.length){
        return output;
    }

    for (const character of data){
        output.cp.push(character.cp);
        output.characters.push(character);

        for (const attribute of character.provides.attributes){
            const existing = _.findWhere(output.attributes, {name: attribute.name});
            if (!existing){
                output.attributes.push({
                    name: attribute.name,
                    values: [attribute.value]
                });
            } else {
                existing.values.push(attribute.value);

            }
        }

        for (const attribute of character.provides.internalAttributes){
            const existing = _.findWhere(output.attributes, {name: attribute.name});
            if (!existing){
                output.attributes.push({
                    name: attribute.name,
                    values: [attribute.value],
                    internal: true,
                });
            } else {
                existing.values.push(attribute.value);

            }
        }

        for (const skill of character.provides.skills){
            for (const tag of skill.tags){
                if (!_.has(output.skills, tag.name)){
                    output.skills[tag.name] = [];
                }
                const existing = _.findWhere(output.skills[tag.name], {id:skill.id});
                if (existing){
                    if (_.indexOf(existing.characters, character.id)=== -1){
                        existing.characters.push(character.id);
                    }
                } else {
                    skill.characters = [character.id];
                    output.skills[tag.name].push(skill);
                }
            }
        }
        for (const type in character.provides.traits){
            if (!_.has(output.traits, type)){
                output.traits[type] = {};
            }
            for (const trait of character.provides.traits[type]){
                if (!_.has(output.traits[type], trait)){
                    output.traits[type][trait] = [];
                }
                output.traits[type][trait].push(character.id);
            }
        }
        for (const language of character.provides.languages){
            if (!_.has(output.languages, language)){
                output.languages[language] = [];
            }
            output.languages[language].push(character.id);
        }

        for (const trait of character.provides.diagnose){
            if (!_.has(output.diagnose, trait)){
                output.diagnose[trait] = [];
            }
            output.diagnose[trait].push(character.id);
        }
        for (const style in character.provides.styles){
            if (!_.has(output.styles, style)){
                output.styles[style] = [];
            }
            output.styles[style].push(character.id);
        }

    }

    output.cp = arrayAggregate(output.cp);
    output.attributes = output.attributes.map(attribute => {
        attribute.values = arrayAggregate(attribute.values);
        return attribute;
    });
    output.attributes = await campaignHelper.attributeSorter(output.attributes, campaignId);

    return output;
}

function arrayAggregate(arr){
    const output = {
        data: arr,
        length: arr.length,
        min: Math.min(...arr),
        max: Math.max(...arr),
    };
    output.sum = arr.reduce((o,e) => { return o + e;}, 0);
    output.avg = Math.round(output.sum / output.length * 10) / 10;
    return output;
}
