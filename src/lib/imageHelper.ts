'use strict';
import _ from 'underscore';
import config from 'config';
import aws from 'aws-sdk';
import sharp from 'sharp';
import path from 'path';
import {Readable} from 'stream';

function getKey(image: ImageModel, uriEncoded?:boolean): string{
    if (uriEncoded){
        return ['images', image.id, encodeURIComponent(image.name)].join('/');
    } else {
        return ['images', image.id, image.name].join('/');
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

function getUrl(image: ImageModel): string{
    const key = getKey(image, true);
    return`https://${config.get('aws.imageBucket')}.s3.amazonaws.com/${key}`;
};

function getThumbnailUrl(image: ImageModel): string{
    const key = getThumbnailKey(image, true);
    return`https://${config.get('aws.imageBucket')}.s3.amazonaws.com/${key}`;
};

function sorter(a:ImageModel, b:ImageModel){
    if (!b || _.isNull(b)){
        return a;
    }
    if (!a || _.isNull(a)){
        return b;
    }
    let idxA = a.name;
    if (_.has(a, 'display_name') && !_.isNull(a.display_name) && a.display_name !== ''){
        idxA = a.display_name;
    }
    let idxB = b.name;
    if (_.has(b, 'display_name') && !_.isNull(b.display_name) && b.display_name !== ''){
        idxB = b.display_name;
    }
    return idxA.localeCompare(idxB);
};

function getStream(image: ImageModel):Readable{
    const key = getKey(image);
    const s3 = new aws.S3({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        signatureVersion: 'v4',

    });
    const options:aws.S3.GetObjectRequest = {
        Bucket: config.get('aws.imageBucket'),
        Key: key
    };
    return s3.getObject(options).createReadStream();
};

async function signS3(key:string, fileType:string): Promise<string> {
    return new Promise((resolve,reject) => {
        const s3 = new aws.S3({
            accessKeyId: config.get('aws.accessKeyId'),
            secretAccessKey: config.get('aws.secretKey'),
            signatureVersion: 'v4',
        });

        const s3Params = {
            Bucket: config.get('aws.imageBucket'),
            Key: key,
            Expires: 60,
            ContentType: fileType,
            ACL: 'public-read'
        };

        s3.getSignedUrl('putObject', s3Params, (err, url) => {
            if (err) reject(err);
            resolve(url);
        });
    });
};

let uploadCount = 0;

async function upload(key:string, dataStream:Readable){
    uploadCount++;
    const s3 = new aws.S3({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        signatureVersion: 'v4',
    });
    const params:aws.S3.PutObjectRequest = {
        Bucket: config.get('aws.imageBucket'),
        Key: key,
        Body: dataStream
    };

    await s3.upload(params).promise();
    uploadCount--;
    return;
};


async function copy(oldKey:string, newKey:string){
    return new Promise((resolve,reject) => {
        const s3 = new aws.S3({
            accessKeyId: config.get('aws.accessKeyId'),
            secretAccessKey: config.get('aws.secretKey'),
            signatureVersion: 'v4',
        });

        s3.copyObject({
            Bucket: config.get('aws.imageBucket'),
            CopySource: `${config.get('aws.imageBucket')}/${oldKey}`,
            Key: newKey
        }, function(err, data){
            if (err) reject(err);
            resolve(data);
        });
    });
};

async function remove(key:string){
    console.log(`Removing ${config.get('aws.imageBucket')}/${key}`);
    return new Promise((resolve,reject) => {
        const s3 = new aws.S3({
            accessKeyId: config.get('aws.accessKeyId'),
            secretAccessKey: config.get('aws.secretKey'),
            signatureVersion: 'v4',
        });
        s3.deleteObject({
            Bucket: config.get('aws.imageBucket'),
            Key: key
        }, function(err, data){
            if (err) reject(err);
            resolve(data);
        });
    });
};

async function rename(oldKey:string, newKey:string){
    await copy(oldKey, newKey);
    return remove(oldKey);
};

async function list(prefix:string) {
    if (!prefix){
        prefix = 'images';
    }
    return new Promise((resolve,reject) => {
        const s3 = new aws.S3({
            accessKeyId: config.get('aws.accessKeyId'),
            secretAccessKey: config.get('aws.secretKey'),
            signatureVersion: 'v4',
        });
        s3.listObjects({
            Bucket: config.get('aws.imageBucket'),
            Prefix: prefix
        }, function(err, data){
            if (err) reject(err);
            resolve(data.Contents);
        });
    });
};

async function getImageDetails(image:ImageModel): Promise<sharp.Metadata> {
    return new Promise((resolve, reject) => {
        const s3Stream = getStream(image);
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
    const key = getKey(image);
    const thumbnailKey = getThumbnailKey(image);
    if (!image.height || !image.width || (image.height < thumbnailSize && image.width < thumbnailSize)){
        return copy(key, thumbnailKey);
    }
    try{
        const s3Stream = getStream(image);
        const thumbnail = await makeThumbnail(s3Stream, thumbnailSize);
        return upload(thumbnailKey, Readable.from(thumbnail));
    } catch (err){
        console.trace(err);
        return copy(key, thumbnailKey);
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
    getKey,
    getThumbnailKey,
    getUrl,
    getThumbnailUrl,
    sorter,
    getStream,
    signS3,
    uploadCount,
    upload,
    copy,
    remove,
    rename,
    list,
    getImageDetails,
    buildThumbnail

}
