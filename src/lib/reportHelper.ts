'use strict';
import async from 'async';
import _ from 'underscore';
import Character from './Character';
import campaignHelper from './campaignHelper';

async function data(characterList:number[], campaignId: number){
    const characterData = await async.map(characterList, async (characterId: number): Promise<CharacterData> => {
        const character = new Character({ id: characterId });
        await character.init();
        if (character._data.campaign_id !== campaignId) {
            throw new Error('invalid character');
        }
        return character.data();
    });

    return aggregateCharacterData(characterData, campaignId);
};

interface AggregateCharacterData{
    attributes: ModelData[] ,
    cp: number[] | ArrayAggregate
    skills: Record<string, ModelData[]>,
    characters: CharacterData[],
    traits: Record<string, Record<string, number[]>>,
    languages: Record<string, number[]>,
    diagnose: Record<string, number[]>,
    styles: Record<string, number[]>,
}

async function aggregateCharacterData(data: CharacterData[], campaignId:number): Promise<AggregateCharacterData>{
    const output: AggregateCharacterData = {
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
        (output.cp as number[]).push(character.cp);
        output.characters.push(character);

        for (const attribute of character.provides.attributes as AttributeRecord[]){
            let existing = _.findWhere(output.attributes, {name: attribute.name});
            if (!existing){
                existing = {
                    name: attribute.name,
                    values: []
                };

                output.attributes.push(existing);
            }

            if (typeof attribute.value === 'number'){
                (existing.values as number[]).push(attribute.value);
            } else {
                for (const value of attribute.value){
                    if (_.indexOf(existing.values as string[], value) === -1){
                        (existing.values as string[]).push(value);
                    }
                }
            }
        }

        for (const attribute of character.provides.internalAttributes){
            let existing = _.findWhere(output.attributes, {name: attribute.name});
            if (!existing){
                existing = {
                    name: attribute.name,
                    values: [],
                    internal: true,
                };
                output.attributes.push(existing);
            }
            if (typeof attribute.value === 'number'){
                (existing.values as number[]).push(attribute.value);
            } else {
                for (const value of attribute.value){
                    if (_.indexOf(existing.values as string[], value) === -1){
                        (existing.values as string[]).push(value);
                    }
                }
            }
        }

        for (const skill of character.provides.skills){
            for (const tag of skill.tags as SkillTagModel[]){
                if (!_.has(output.skills, tag.name)){
                    output.skills[tag.name] = [];
                }
                const existing = _.findWhere(output.skills[tag.name], {id:skill.id});
                if (existing){
                    if (_.indexOf((existing.characters as number[]), character.id)=== -1){
                        (existing.characters as number[]).push(character.id);
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

    output.cp = arrayAggregate(output.cp as number[]);
    output.attributes = output.attributes.map(attribute => {
        attribute.values = arrayAggregate(attribute.values as number[]);
        return attribute;
    });
    output.attributes = await campaignHelper.attributeSorter(output.attributes, campaignId);

    return output;
}

interface ArrayAggregate {
    data: number[] | string[],
    length: number,
    min: number,
    max: number,
    sum: number,
    avg: number
}

function arrayAggregate(arr: number[]): ArrayAggregate{
    if (arr.length && typeof arr[0] !== 'number'){
        return {
            data: arr,
            length: arr.length,
            min: null,
            max: null,
            sum: null,
            avg: null
        };
    }
    const output: ArrayAggregate = {
        data: arr,
        length: arr.length,
        min: Math.min(...arr),
        max: Math.max(...arr),
        sum:null,
        avg:null
    };
    output.sum = arr.reduce((o,e) => { return o + e;}, 0);
    output.avg = Math.round(output.sum / output.length * 10) / 10;
    return output;
}

export default { data }
