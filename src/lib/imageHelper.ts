'use strict';
import config from 'config';
import sharp from 'sharp';
import path from 'path';
import {Readable} from 'stream';

import uploadHelper from './uploadHelper';

function getThumbnailKey(image: ImageModel, uriEncoded?:boolean): string{
    const parts = path.parse(image.upload.name);
    const filename = [parts.name, '_thumbnail', parts.ext].join('');
    if (uriEncoded){
        return ['images', image.upload.id, encodeURIComponent(filename)].join('/');
    } else {
        return ['images', image.upload.id, filename].join('/');
    }
};

function getThumbnailUrl(image: ImageModel): string{
    const key = getThumbnailKey(image, true);
    return`https://${config.get('aws.imageBucket')}.s3.amazonaws.com/${key}`;
};

async function getImageDetails(image:ImageModel): Promise<sharp.Metadata> {
    return new Promise((resolve, reject) => {
        const s3Stream = uploadHelper.getStream(image.upload);
        const metadataStream = sharp();
        metadataStream.metadata().then(metadata => {
            resolve(metadata);
        }).catch(err => {
            reject(err);
        });
        s3Stream.pipe(metadataStream);
    });
};

//Exported
async function buildThumbnail(image:ImageModel){
    const thumbnailSize = config.get('images.thumbnailSize');
    const key = uploadHelper.getKey(image.upload);
    const thumbnailKey = getThumbnailKey(image);
    if (!image.height || !image.width || (image.height < thumbnailSize && image.width < thumbnailSize)){
        console.log('copy due to tiny')

        return uploadHelper.copy(key, thumbnailKey);
    }
    try{
        const s3Stream = uploadHelper.getStream(image.upload);
        const thumbnail = await makeThumbnail(s3Stream, thumbnailSize);
        return uploadHelper.upload(thumbnailKey, Readable.from(thumbnail));
    } catch (err){
        console.trace(err);
        return uploadHelper.copy(key, thumbnailKey);
    }
};

//internal
async function makeThumbnail(inStream, thumbnailSize):Promise<Buffer>{
    return new Promise((resolve, reject) => {
        const resizer = sharp().resize({
            width: thumbnailSize,
            height:thumbnailSize,
            fit: 'inside' })
            .on('error', err => { reject(err); });
        inStream
            .pipe(resizer)
            .toBuffer()
            .then(data => {
                resolve(data);
            });
    });
}

export default {
    getThumbnailKey,
    getThumbnailUrl,
    getImageDetails,
    buildThumbnail

}
