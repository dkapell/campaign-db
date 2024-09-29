'use strict';

const mapHelper = require('../../lib/mapHelper');
const imageHelper = require('../../lib/imageHelper');
const models = require('../../lib/models');
const image_id = 24; // map
const mapId = 1;

(async function main() {
    console.log(await mapHelper.countPCVisible(3));
    //const image = await models.image.get(image_id);
    //await imageHelper.buildThumbnail(image);
    //console.log(image);
    //await models.image.update(image_id, await imageHelper.fillImageDetails(image));

    //console.log(await imageHelper.getImageDetails(image));
    //await mapHelper.clean(mapId);
    //await mapHelper.build(mapId);
    //await mapHelper.clean(mapId);
    console.log('done');
    process.exit(0);
})().catch((error) => {
    console.trace(error);
    process.exit(1);
});
