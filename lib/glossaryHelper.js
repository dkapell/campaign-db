'use strict';

const _ = require('underscore');
const querystring = require('querystring');
const async = require('async');
const {marked} = require('marked');
const pluralize = require('pluralize');
const models = require('./models');


const renderer = {
    link(href, title, text) {
        var link = marked.Renderer.prototype.link.call(this, href, title, text);
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

exports.format = async function(content, anchor, is_gm, allEntries){
    const linkBracketRegex = /\[\[\s*([^[\]]+?)\s*\]\]/gm;

    if (!allEntries){
        allEntries = await getAllEntries();
    }

    const linked = content.replace(linkBracketRegex, m => {
        return fillEntry(m, anchor, is_gm, allEntries);
    });

    const playerExtension = getGmBlock(is_gm);
    marked.use({extensions: [playerExtension]});
    return marked(linked, {breaks:true});
};

exports.prepEntries = async function(glossary_entries, is_gm){
    let entries = [];
    if (is_gm){
        entries = glossary_entries;
    } else {
        entries = glossary_entries.filter( entry => {
            return entry.status && entry.status.display_to_pc;
        });
    }
    const allEntries = await getAllEntries();
    return async.map(entries, async entry => {
        if (entry.content){
            entry.content = {
                anchor: await exports.format(entry.content, true, is_gm, allEntries),
                entry: await exports.format(entry.content, false, is_gm, allEntries),
            };
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
        tokenizer: function(src, tokens){
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
                return `<span class='text-dark'><strong class='text-info' >GM Note:</strong> ${this.parser.parseInline(token.tokens)}</span>\n`;
            }
            return '';
        }
    };
}

exports.sorterLetter = function sorter(entries){
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

exports.sorter = function sorter(entries){
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
            for (const val in output[type][category]){
                for (const name in output[type][category]){
                    output[type][category][name] = output[type][category][name].sort( (a,b) => a.name.localeCompare(b.name) );
                }
            }
        }
    }
    return output;
};

exports.reviewReady = async function(){
    const status = await models.glossary_status.findOne({name:'Ready'});
    if (!status) { return false;}
    const entries = await models.glossary_entry.find({status_id: status.id});
    return entries.length > 0;
};

async function getAllEntries(){
    const allEntries = await models.glossary_entry.find();
    return allEntries.map(entry => {
        entry.lowerName = entry.name.toLowerCase();
        return entry;
    });
}
