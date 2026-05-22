'use strict';
import uploadHelper from './uploadHelper';
import models from './models';
import bent from 'bent';
import cache from './cache';
import config from 'config';
import _ from 'underscore';
import { Readable } from 'stream'

const fontStyles = {
    regular: ['regular'],
    bold: ['700', '900', 'regular'],
    italic: ['italic', 'regular'],
    bolditalic: ['700italic', '900italic', 'italic', 'regular'],
}

const fontCache = {};

async function getBuffer(fontId:number, style?:string): Promise<{font: Buffer, oblique:boolean}>{
    style ||= 'regular';
    const font = await models.font.get(fontId);
    if (!font){
        throw new Error ('Invalid Font')
    }
    const { buffer, substyle } = checkCache(font.name, style);

    if (buffer){
        return {
            font: buffer,
            oblique: style.match(/italic/) && !substyle.match(/italic/)
        };
    }

    if (font.type === 'user'){
        const stream = uploadHelper.getStream(font.upload);
        const newBuffer = await streamToBuffer(stream);
        return {
            font: storeCache(font.name, style, style, newBuffer),
            oblique:false
        };

    } else if (font.type === 'google'){
        const googleFont = await getGoogleFont(font.name);
        let found = false;
        for (const substyle of fontStyles[style]){
            if (_.has(googleFont.files, substyle)){
                const getBuffer = bent('buffer');
                found = true;
                const newBuffer = await getBuffer(googleFont.files[substyle]);
                return {
                    font: storeCache(font.name, style, substyle, newBuffer),
                    oblique:style.match(/italic/) && !substyle.match(/italic/)
                };
            }
        }
        if (!found){
            console.log (`font not found: ${font.name}: ${style}\n${JSON.stringify(googleFont.files, null, 2)}`)
        }

    }
    return null;
}

function checkCache(name:string, style:string): {buffer:Buffer, substyle:string}{
    if (_.has(fontCache, name) && _.has(fontCache[name], style)){
        if (fontCache[name][style].timestamp.getTime() < 1000*60*5){
             return {
                buffer: Buffer.from(fontCache[name][style].data, 'base64'),
                substyle: fontCache[name][style].substyle
            }
        }
    }
    return {buffer:null, substyle:null};
}
function storeCache(name:string, style:string, substyle:string, buffer):Buffer{
    if (!_.has(fontCache, name)){
        fontCache[name] = {};
    }
    fontCache[name][style] = {
        timestamp: new Date(),
        substyle: substyle,
        data: buffer.toString('base64')
    };
    return Buffer.from(buffer, 'base64');
}

async function streamToBuffer(readableStream:Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', data => {
      if (typeof data === 'string') {
        // Convert string to Buffer assuming UTF-8 encoding
        chunks.push(Buffer.from(data, 'utf-8'));
      } else if (data instanceof Buffer) {
        chunks.push(data);
      } else {
        // Convert other data types to JSON and then to a Buffer
        const jsonData = JSON.stringify(data);
        chunks.push(Buffer.from(jsonData, 'utf-8'));
      }
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

async function listFonts(){
    try{
        let fonts = await cache.check('fontcache', 'list');
        if (fonts){ return fonts; }
        const url = `https://www.googleapis.com/webfonts/v1/webfonts?sort=alpha&key=${config.get('googleFonts.apiKey')}`
        const getJSON = bent('json');
        fonts = await getJSON(url);
        await cache.store('fontcache', 'list', fonts.items, 300);
        return fonts.items;
    } catch (err){
        console.trace(err);
        return [];
    }
}

async function getGoogleFont(name){
    let font = await cache.check('fontcache', name);
    if (font) { return font; }
    const url = `https://www.googleapis.com/webfonts/v1/webfonts?family=${name}&key=${config.get('googleFonts.apiKey')}`
    const getJSON = bent('json');
    font = await getJSON(url);
    await cache.store('fontcache', name, font.items[0], 300);
    return font.items[0]
}

export default {
    buffer: getBuffer,
    list: listFonts,
    get: getGoogleFont
}

