'use strict';
import config from 'config';
import sharp from 'sharp';
import {Readable} from 'stream';
import convert from 'heic-convert';

import uploadHelper from './uploadHelper';

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
    const thumbnailKey = uploadHelper.getKey(image.upload, {thumbnail:true});
    const bucket = uploadHelper.getBucket(image.upload)

    if (!image.height || !image.width || (image.height < thumbnailSize && image.width < thumbnailSize)){
        console.log('copy due to tiny')
        return uploadHelper.copy({key:key, bucket:bucket}, {key:thumbnailKey, bucket:bucket});
    }
    try{
        const contentType = await uploadHelper.getContentType(image.upload);
        let thumbnail = null
        if (contentType === 'image/heic'){
            const s3Buffer = await uploadHelper.getBuffer(image.upload);

            const convertedImage = await convert({
                buffer: s3Buffer,
                format: 'JPEG',
                quality: 1
            });
            const imageStream = Readable.from(convertedImage);
            thumbnail = await makeThumbnail(imageStream, thumbnailSize);
            await uploadHelper.upload(bucket, key, Readable.from(convertedImage));

        } else {
            const s3Stream = uploadHelper.getStream(image.upload);

            thumbnail = await makeThumbnail(s3Stream, thumbnailSize);
        }
        return uploadHelper.upload(bucket, thumbnailKey, Readable.from(thumbnail));
    } catch (err){
        console.trace(err);
        return uploadHelper.copy({key:key, bucket:bucket}, {key:thumbnailKey, bucket:bucket});
    }
};

//internal
async function makeThumbnail(inStream, thumbnailSize):Promise<Buffer>{
    return new Promise((resolve, reject) => {
        const resizer = sharp().resize({
            width: thumbnailSize,
            height:thumbnailSize,
            fit: 'inside' })
            .rotate()
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
    getImageDetails,
    buildThumbnail

}
