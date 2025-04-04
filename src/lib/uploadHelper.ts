'use strict';
import _ from 'underscore';
import config from 'config';
import aws from 'aws-sdk';
import {Readable} from 'stream';

function getKey(upload: UploadModel, uriEncoded?:boolean): string{
    let folder = null;
    switch (upload.type){
        case 'image': folder = 'images'; break;
        case 'document': folder = 'documents'; break;
        case 'font': folder = 'fonts'; break;
        default: folder = 'uploads';
    }

    if (uriEncoded){
        return [folder, upload.id, encodeURIComponent(upload.name)].join('/');
    } else {
        return [folder, upload.id, upload.name].join('/');
    }
};

function getUrl(upload: UploadModel): string{
    const key = getKey(upload, true);
    return`https://${config.get('aws.imageBucket')}.s3.amazonaws.com/${key}`;
};

function sorter(a:UploadModel, b:UploadModel){
    if (!b || _.isNull(b)){
        return a;
    }
    if (!a || _.isNull(a)){
        return b;
    }
    let idxA = null;
    if (_.has(a, 'upload')){
        idxA = a.upload.name;
        if (_.has(a.upload, 'display_name') && !_.isNull(a.upload.display_name) && a.upload.display_name !== ''){
            idxA = a.upload.display_name;
        }
    } else {
        idxA = a.name;
        if (_.has(a, 'display_name') && !_.isNull(a.display_name) && a.display_name !== ''){
            idxA = a.display_name;
        }
    }
    let idxB = null;
    if (_.has(b, 'upload')){
        idxB = b.upload.name;
        if (_.has(b.upload, 'display_name') && !_.isNull(b.upload.display_name) && b.upload.display_name !== ''){
            idxB = b.upload.display_name;
        }
    } else {
        idxB = b.name;
        if (_.has(b, 'display_name') && !_.isNull(b.display_name) && b.display_name !== ''){
            idxB = b.display_name;
        }
    }

    return idxA.localeCompare(idxB);
};

function getStream(upload: UploadModel):Readable{
    const key = getKey(upload);
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
            CopySource: encodeURI(`${config.get('aws.imageBucket')}/${oldKey}`),
            Key: newKey
        }, function(err, data){
            console.log(err);
            if (err) return reject(err);
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
            if (err) return reject(err);
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

async function getSize(upload: UploadModel){
    const key = getKey(upload);
    const s3 = new aws.S3({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        signatureVersion: 'v4',

    });
    const options:aws.S3.HeadObjectRequest = {
        Bucket: config.get('aws.imageBucket'),
        Key: key
    };
    return new Promise((resolve,reject) => {
        s3.headObject(options, function(err, data){
            if (err) { return reject(err); }
            resolve(data.ContentLength);
        });
    });
}

function uploadMiddleware(){
    return function(req, res, next){
        req.upload = {
            makeEmptyUpload: async function makeEmptyUpload(fileName, type){
                const user = req.session.assumed_user ? req.session.assumed_user: req.user;
                const uploadData = {
                    name: fileName,
                    campaign_id: req.campaign.id,
                    user_id: user.id,
                    type: type
                };
                const uploadId = await req.models.upload.create(uploadData);
                return req.models.upload.get(uploadId);
            },
            getUpload: async function getUpload(id){
                const upload = await req.models.upload(id);
                if (!upload){ return null; }
                if (upload.user_id){
                    upload.user = req.models.user.get(req.campaign.id, upload.user_id);
                }
                return upload;
            }
        };
        next();
    }
}

export default {
    getKey,
    getUrl,
    sorter,
    getStream,
    getSize,
    signS3,
    uploadCount,
    upload,
    copy,
    remove,
    rename,
    list,
    middleware: uploadMiddleware
}
