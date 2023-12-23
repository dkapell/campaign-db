'use strict';

const sharp = require('sharp');
const async = require('async');
const unzipper = require('unzip-stream');
const _ = require('underscore');
const models = require('../lib/models');
const imageHelper = require('../lib/imageHelper');
const Transform = require('stream').Transform;
const {pipeline} = require('node:stream/promises');
const RateLimiter = require('limiter').RateLimiter;

const limiter = new RateLimiter({ tokensPerInterval: 1, interval: 1000 });


exports.build = async function build(mapId){
    let map = await models.map.get(mapId);
    const s3Stream = imageHelper.getStream(map.image);
    await buildTiles(map, s3Stream);
    map = await models.map.get(mapId);
    map.status = 'ready';
    return models.map.update(mapId, map);
};

exports.clean = async function clean(mapId){
    let map = await models.map.get(mapId);
    console.log(`Cleaning ${getMapPrefix(map.id, map.uuid)}`);
    const fileList = await imageHelper.list(getMapPrefix(map.id, map.uuid));
    const files = _.pluck(fileList, 'Key');
    await async.each(files, imageHelper.remove);
    map = await models.map.get(mapId);
    map.status = 'cleaned';
    return models.map.update(mapId, map);
};

exports.countPCVisible = async function countPCVisible(campaignId){
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
