'use strict';
const _ = require('underscore');
const config = require('config');
const aws = require('aws-sdk');
const models = require('./models');
const sharp = require('sharp');
const path = require('path');
const Readable = require('stream').Readable;

exports.getKey = function getKey(image, uriEncoded){
    if (uriEncoded){
        return ['images', image.id, encodeURIComponent(image.name)].join('/');
    } else {
        return ['images', image.id, image.name].join('/');
    }
};

exports.getThumbnailKey = function getKey(image, uriEncoded){
    const parts = path.parse(image.name);
    const filename = [parts.name, '_thumbnail', parts.ext].join('');
    if (uriEncoded){
        return ['images', image.id, encodeURIComponent(filename)].join('/');
    } else {
        return ['images', image.id, filename].join('/');
    }
};

exports.getUrl = function(image){
    const key = exports.getKey(image, true);
    return`https://${config.get('aws.imageBucket')}.s3.amazonaws.com/${key}`;
};

exports.getThumbnailUrl = function(image){
    const key = exports.getThumbnailKey(image, true);
    return`https://${config.get('aws.imageBucket')}.s3.amazonaws.com/${key}`;
};

exports.sorter = function imageSorter(a, b){
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
}

exports.getStream = function(image){
    const key = exports.getKey(image);
    const s3 = new aws.S3({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        signatureVersion: 'v4',

    });
    const options = {
        Bucket: config.get('aws.imageBucket'),
        Key: key
    };
    return s3.getObject(options).createReadStream();
};

exports.signS3 = async function signS3(key, fileType){
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

exports.uploadCount = 0;
exports.upload = async function upload(key, dataStream){
    exports.uploadCount++;
    const s3 = new aws.S3({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        signatureVersion: 'v4',
    });
    const params = {
        Bucket: config.get('aws.imageBucket'),
        Key: key,
        Body: dataStream
    };

    await s3.upload(params).promise();
    exports.uploadCount--;
    return;
};


exports.copy = async function copy(oldKey, newKey){
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

exports.remove = async function remove(key){
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

exports.rename = async function move(oldKey, newKey){
    await exports.copy(oldKey, newKey);
    return exports.remove(oldKey);
};

exports.list = async function list(prefix) {
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

exports.getImageDetails = async function getImageDetails(image){
    return new Promise((resolve, reject) => {
        const s3Stream = exports.getStream(image);
        const metadataStream = sharp();
        metadataStream.metadata().then(metadata => {
            resolve(metadata);
        });
        s3Stream.pipe(metadataStream);
    });
};

exports.buildThumbnail = async function buildThumbnail(image){
    const thumbnailSize = config.get('images.thumbnailSize');
    const key = exports.getKey(image);
    const thumbnailKey = exports.getThumbnailKey(image);
    if (!image.height || !image.width || (image.height < thumbnailSize && image.width < thumbnailSize)){
        return exports.copy(key, thumbnailKey);
    }
    const s3Stream = exports.getStream(image);
    const thumbnail = await makeThumbnail(s3Stream, thumbnailSize);
    return exports.upload(thumbnailKey, Readable.from(thumbnail));
};

async function makeThumbnail(inStream, thumbnailSize){
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
