'use strict';

import sharp from 'sharp';
import async from 'async';
import unzipper from 'unzip-stream';
import _ from 'underscore';
import models from '../lib/models';
import imageHelper from '../lib/imageHelper';
import { pipeline } from 'node:stream/promises';

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function build(mapId:number): Promise<void> {
    let map = await models.map.get(mapId);
    const s3Stream = imageHelper.getStream(map.image);
    await buildTiles(map, s3Stream);
    await async.until(
        async ()=> {return !imageHelper.uploadCount;},
        async ()=> {
            await timeout(200);
        }
    );
    map = await models.map.get(mapId);
    map.status = 'ready';
    return models.map.update(mapId, map);
};

async function clean(mapId:number): Promise<void> {
    let map = await models.map.get(mapId);
    console.log(`Cleaning ${getMapPrefix(map.id, map.uuid)}`);
    const fileList = await imageHelper.list(getMapPrefix(map.id, map.uuid));
    const files = _.pluck(fileList, 'Key');
    await async.each(files, imageHelper.remove);
    map = await models.map.get(mapId);
    map.status = 'cleaned';
    return models.map.update(mapId, map);
};

async function countPCVisible(campaignId: number): Promise<number> {
    return models.map.count({campaign_id:campaignId, display_to_pc:true});
};

function buildTiles(map, inStream){
    const tileifier = sharp().tile({
        size: 512,
        basename: 'tile'
    });

    const parseStream = unzipper.Parse()
        .on('entry', async function (entry) {
            const filename = entry.path;
            entry.on('error', e => {console.trace(e); });
            console.log(filename);
            parseStream.pause();
            //await limiter.removeTokens(1);
            await imageHelper.upload(getTileKey(map.id, map.uuid, filename), entry);
            parseStream.resume();

        });

    return pipeline(
        inStream,
        tileifier,
        parseStream
    );
}

function getTileKey(id, uuid, filename){
    return ['tiles', id, uuid, filename].join('/');

}

function getMapPrefix(id, uuid){
    return ['tiles', id, uuid].join('/');
}

export default {
    build,
    clean,
    countPCVisible
}
