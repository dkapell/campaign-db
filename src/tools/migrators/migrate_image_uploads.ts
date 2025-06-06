#!/usr/bin/env node

/**
 * Module dependencies.
 */

import path from 'path';

import uploadHelper from '../../lib/uploadHelper';
import imageModel from '../../models/image';
import uploadModel from '../../models/upload';
const models = {
    image: imageModel,
    upload: uploadModel,
};

(async function main() {
    //await new Promise(r => setTimeout(r, 1000));
    const images = await models.image.find();
    for (const image of images as ImageModel[]){
        const bucket = uploadHelper.getBucket(image.upload);

        const oldKey = getKey(image);
        const newKey = uploadHelper.getKey(image.upload);
        console.log(`${oldKey} -> ${newKey}`);
        await uploadHelper.rename({bucket:bucket, key:oldKey}, {bucket:bucket, key:newKey});

        const oldThumbKey = getThumbnailKey(image);
        const newThumbKey = uploadHelper.getKey(image, {thumbnail:true});
        console.log(`${oldThumbKey} -> ${newThumbKey}`);
        await uploadHelper.rename({bucket:bucket, key:oldThumbKey}, {bucket:bucket, key:newThumbKey});

    }

    process.exit(0);

})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});

function getKey(upload: ImageModel, uriEncoded?:boolean): string{
    if (uriEncoded){
        return ['images', upload.id, encodeURIComponent(upload.name)].join('/');
    } else {
        return ['images', upload.id, upload.name].join('/');
    }
};

function getThumbnailKey(image: ImageModel, uriEncoded?:boolean): string{
    const parts = path.parse(image.name);
    const filename = [parts.name, '_thumbnail', parts.ext].join('');
    if (uriEncoded){
        return ['images', image.id, encodeURIComponent(filename)].join('/');
    } else {
        return ['images', image.id, filename].join('/');
    }
};
