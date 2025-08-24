'use strict';

import _ from 'underscore';
import querystring from 'querystring';
import async from 'async';
import { marked } from 'marked';
import pluralize from 'pluralize';
import models from './models';


const renderer = {
    link(href, title, text) {
        const link = marked.Renderer.prototype.link.call(this, href, title, text);
        if (href.match(/glossary\/new/)){
            return link.replace('<a','<a class="text-danger"');
        }
        if (href.match(/^#/)){
            return link.replace('<a','<a class="glossary-anchor-link"');
        }
        return link;
    }
};
marked.use({ renderer });

async function format(content:string, anchor:boolean, is_gm:boolean, allEntries:ModelData[], campaignId:number){
    const linkBracketRegex = /\[\[\s*([^[\]]+?)\s*\]\]/gm;

    if (!allEntries){
        allEntries = await getAllEntries(campaignId);
    }

    const linked = content.replace(linkBracketRegex, m => {
        return fillEntry(m, anchor, is_gm, allEntries);
    });

    const playerExtension = getGmBlock(is_gm);
    marked.use({extensions: [playerExtension]});
    return marked.parse(linked, {breaks:true});
};

async function prepEntries(glossary_entries, is_gm:boolean, campaignId:number){
    let entries = [];
    if (is_gm){
        entries = glossary_entries;
    } else {
        entries = glossary_entries.filter( entry => {
            return entry.status && entry.status.display_to_pc;
        });
    }
    const allEntries = await getAllEntries(campaignId);
    return async.map(entries, async entry => {
        if (entry.content){
            entry.content = {
                anchor: await format(entry.content, true, is_gm, allEntries, campaignId),
                entry: await format(entry.content, false, is_gm, allEntries, campaignId),
            };
        } else {
            entry.content = {
                anchor:'<p><i>No Content</i></p>',
                entry: '<p><i>No Content</i></p>'
           }
        }
        if (!is_gm){
            entry.tags = entry.tags.filter(tag => { return tag.display_to_pc});
        }
        return entry;
    });
};

function fillEntry(match, anchor, is_gm, allEntries){
    const name = match.replace(/(^\[\[\s*|\s*\]\]$)/g, '');
    const lowerName = name.toLowerCase();
    const entry = {
        raw: _.findWhere(allEntries, {lowerName: lowerName}),
        singular: _.findWhere(allEntries, {lowerName: pluralize.singular(lowerName)}),
        plural: _.findWhere(allEntries, {lowerName: pluralize(lowerName)}),
    };

    if (entry.raw){
        return buildLink(name, entry.raw);
    } else if (entry.singular){
        return buildLink(name, entry.singular);
    } else if (entry.plural){
        return buildLink(name, entry.plural);
    } else if (is_gm){
        return `[${name}](/glossary/new?name=${querystring.escape(name)})`;
    } else {
        return name;
    }

    function buildLink(name, entry){
        if (is_gm || (entry.status && entry.status.display_to_pc)){
            if (anchor){
                return `[${name}](#entry-${entry.name.replace(/\W+/g, '_').toLowerCase()})`;
            } else {
                return `[${name}](/glossary/${entry.id}/${querystring.escape(entry.name)})`;
            }
        } else {
            return name;
        }
    }
}

function getGmBlock(is_gm){
    return {
        name: 'gmblock',
        level: 'inline',
        start: function(src) {
            return src.match(/\[gm\s+/i)?.index;
        },
        tokenizer: function(src ){
            const rule = /^\[gm\s+(.+?)(?<!\])\](?!([\](]))/is;    // Regex for the complete token
            const match = rule.exec(src);
            if (match) {
                return {                                          // Token to generate
                    type: 'gmblock',                              // Should match "name" above
                    raw: match[0],                         // Text to consume from the source
                    tokens: this.lexer.inlineTokens(match[1].trim())    // inlineTokens to process **bold**, *italics*, etc.
                };
            }

        },
        renderer(token) {
            if (is_gm){
                // parseInline to turn child tokens into HTML
                return `<span class='gm-note-body'><strong class='text-info' >GM Note:</strong> ${this.parser.parseInline(token.tokens)}</span>\n`;
            }
            return '';
        }
    };
}

function sorterLetter(entries){
    const output = {
        alpha: {},
        tag: {}
    };
    for (const entry of entries){
        const type = entry.type;
        const letter = entry.name.substr(0,1).toUpperCase();
        if (!_.has(output, type)){
            output[type] = {};
        }
        if (!_.has(output[type], letter)){
            output[type][letter] = [];
        }
        output[type][letter].push(entry);
    }
    for (const type in output){
        for (const letter in output[type]){
            output[type][letter] = output[type][letter].sort( (a,b) => a.name.localeCompare(b.name) );
        }
    }
    return output;
};

function sorter(entries){
    const output = {};
    for (const entry of entries){
        const type = entry.type;
        if (!_.has(output, type)){
            output[type] = {
                alpha: {},
                tags: {},
                notags: [],
                all: []
            };
        }
        output[type].all.push(entry);
        if (entry.tags.length){

            for (const tag of entry.tags){
                const name = tag.name;

                if (!_.has(output[type].tags, name)){
                    output[type].tags[name] = [];
                }
                output[type].tags[name].push(entry);
            }
        } else {
            output[type].notags.push(entry);
        }

        const letter = entry.name.substr(0,1).toUpperCase();
        if (!_.has(output[type].alpha, letter)){
            output[type].alpha[letter] = [];
        }
        output[type].alpha[letter].push(entry);

    }
    for (const type in output){
        output[type].all = output[type].all.sort( (a,b) => a.name.localeCompare(b.name) );
        for (const category in ['alpha', 'tags']){
            for (const name in output[type][category]){
                output[type][category][name] = output[type][category][name].sort( (a,b) => a.name.localeCompare(b.name) );
            }
        }
    }
    return output;
};

async function reviewReady(campaignId){

    const statuses = await models.glossary_status.find({reviewable: true, campaign_id:campaignId});
    if (!statuses.length) { return false;}
    const entries = [];
    for (const status of statuses){
        entries.push(await models.glossary_entry.find({status_id: status.id}));
    }
    return _.flatten(entries, true).length > 0;
};

async function getAllEntries(campaignId){
    const allEntries = await models.glossary_entry.find({campaign_id:campaignId});
    return allEntries.map(entry => {
        entry.lowerName = entry.name.toLowerCase();
        return entry;
    });
}

export default {
    format,
    prepEntries,
    reviewReady,
    sorter,
    sorterLetter

}
