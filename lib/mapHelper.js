'use strict';

const sharp = require('sharp');
const async = require('async');
const unzipper = require('unzip-stream');
const _ = require('underscore');
const models = require('../lib/models');
const imageHelper = require('../lib/imageHelper');
const Transform = require('stream').Transform;
const {pipeline} = require('node:stream/promises');


exports.build = async function build(mapId){
    const map = await models.map.get(mapId);
    const s3Stream = imageHelper.getStream(map.image);
    return buildTiles(map, s3Stream);
};

exports.clean = async function clean(mapId){
    const map = await models.map.get(mapId);
    console.log(`Cleaning ${getMapPrefix(map.id, map.uuid)}`);
    const fileList = await imageHelper.list(getMapPrefix(map.id, map.uuid));
    const files = _.pluck(fileList, 'Key');
    return async.each(files, imageHelper.remove);
};

exports.countPCVisible = async function countPCVisible(campaignId){
    return models.map.count({campaign_id:campaignId, display_to_pc:true});
};

function buildTiles(map, inStream){
    const tileifier = sharp().tile({
        size: 512,
        basename: 'tile'
    });

    const entryStream = Transform({
        objectMode: true,
        transform: async function(entry,e,cb) {
            const filename = entry.path;
            const type = entry.type; // 'Directory' or 'File'
            entry.on('error', e => {console.trace(e); });
            await imageHelper.upload(getTileKey(map.id, map.uuid, filename), entry);
            cb();
        }
    });

    return pipeline(
        inStream,
        tileifier,
        unzipper.Parse(),
        entryStream
    );
}

function getTileKey(id, uuid, filename){
    return ['tiles', id, uuid, filename].join('/');

}

function getMapPrefix(id, uuid){
    return ['tiles', id, uuid].join('/');
}