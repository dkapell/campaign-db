'use strict';
import _ from 'underscore';
import config from 'config';
import aws from 'aws-sdk';
import {Readable} from 'stream';
import path from 'path';
import surveyHelper from './surveyHelper';
import models from './models';

function getKey(upload: UploadModel, options:UploadOptions = {}): string{

    let folder = '';
    switch (upload.type){
        case 'image': folder += 'images'; break;
        case 'document': folder += 'documents'; break;
        case 'font': folder += 'fonts'; break;
        default: folder += 'uploads';
    }
    let filename = upload.name;
    if (options.thumbnail){
        const parts = path.parse(upload.name);
        filename = [parts.name, '_thumbnail', parts.ext].join('');
    }

    if (options.uriEncoded){
        return [folder, upload.id, encodeURIComponent(filename)].join('/');
    } else {
        return [folder, upload.id, filename].join('/');
    }
};

function getBucket(upload:UploadModel): string{
    return upload.is_public?config.get('aws.assetBucket'):config.get('aws.privateBucket');
}

function getUrl(upload: UploadModel, options:UploadOptions={}): string{
    if (upload.is_public){
        options.uriEncoded = true
        const key = getKey(upload, options);
        return`https://${config.get('aws.assetBucket')}.s3.amazonaws.com/${key}`;
    } else if (options.thumbnail){
        return `/admin/upload/${upload.id}?thumbnail=1`;
    } else {
        return `/admin/upload/${upload.id}`;
    }
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

function getStream(upload: UploadModel, options:UploadOptions={}):Readable{
    const key = getKey(upload, options);
    const s3 = new aws.S3({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        signatureVersion: 'v4',

    });
    const requestOptions:aws.S3.GetObjectRequest = {
        Bucket: upload.is_public?config.get('aws.assetBucket'):config.get('aws.privateBucket'),
        Key: key
    };
    return s3.getObject(requestOptions).createReadStream();
};

async function getBuffer(upload: UploadModel, options:UploadOptions={}):Promise<Buffer>{
    const key = getKey(upload, options);
    const s3 = new aws.S3({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        signatureVersion: 'v4',

    });
    const requestOptions:aws.S3.GetObjectRequest = {
        Bucket: upload.is_public?config.get('aws.assetBucket'):config.get('aws.privateBucket'),
        Key: key
    };
    return new Promise((resolve,reject) => {
        s3.getObject(requestOptions, function(err, data){
            if (err) { return reject(err); }
            resolve(data.Body as Buffer);
        });
    });
};

async function signS3(key:string, fileType:string, isPublic:boolean): Promise<string> {
    return new Promise((resolve,reject) => {
        const s3 = new aws.S3({
            accessKeyId: config.get('aws.accessKeyId'),
            secretAccessKey: config.get('aws.secretKey'),
            signatureVersion: 'v4',
        });

        const s3Params: S3UploadParams  = {
            Bucket: isPublic?config.get('aws.assetBucket'):config.get('aws.privateBucket'),
            Key: key,
            Expires: 60,
            ContentType: fileType
        };

        if (isPublic){
            s3Params.ACL = 'public-read'
        }

        s3.getSignedUrl('putObject', s3Params, (err, url) => {
            if (err) reject(err);
            resolve(url);
        });
    });
};

let uploadCount = 0;

async function upload(bucket: string, key:string, dataStream:Readable){
    uploadCount++;
    const s3 = new aws.S3({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        signatureVersion: 'v4',
    });
    const params:aws.S3.PutObjectRequest = {
        Bucket: bucket,
        Key: key,
        Body: dataStream
    };

    await s3.upload(params).promise();
    uploadCount--;
    return;
};


async function copy(oldFile:S3Location, newFile: S3Location){
    return new Promise((resolve,reject) => {
        const s3 = new aws.S3({
            accessKeyId: config.get('aws.accessKeyId'),
            secretAccessKey: config.get('aws.secretKey'),
            signatureVersion: 'v4',
        });

        s3.copyObject({
            Bucket: newFile.bucket,
            CopySource: encodeURI(`${oldFile.bucket}/${oldFile.key}`),
            Key: newFile.key
        }, function(err, data){
            if (err) return reject(err);
            resolve(data);
        });
    });
};

async function remove(bucket: string, key:string){
    console.log(`Removing ${bucket}/${key}`);
    return new Promise((resolve,reject) => {
        const s3 = new aws.S3({
            accessKeyId: config.get('aws.accessKeyId'),
            secretAccessKey: config.get('aws.secretKey'),
            signatureVersion: 'v4',
        });
        s3.deleteObject({
            Bucket: bucket,
            Key: key
        }, function(err, data){
            if (err) return reject(err);
            resolve(data);
        });
    });
};

async function rename(oldFile:S3Location, newFile: S3Location){
    await copy(oldFile, newFile);
    return remove(oldFile.bucket, oldFile.key);
};

async function list(bucket:string, prefix:string) {
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
            Bucket: config.get('aws.assetBucket'),
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
        Bucket: upload.is_public?config.get('aws.assetBucket'):config.get('aws.privateBucket'),
        Key: key
    };
    return new Promise((resolve,reject) => {
        s3.headObject(options, function(err, data){
            if (err) { return reject(err); }
            resolve(data.ContentLength);
        });
    });
}

async function getContentType(upload: UploadModel){
    const key = getKey(upload);
    const s3 = new aws.S3({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        signatureVersion: 'v4',

    });

    const options:aws.S3.HeadObjectRequest = {
        Bucket: upload.is_public?config.get('aws.assetBucket'):config.get('aws.privateBucket'),
        Key: key
    };
    return new Promise((resolve,reject) => {
        s3.headObject(options, function(err, data){
            if (err) { return reject(err); }
            resolve(data.ContentType);
        });
    });
}

function uploadMiddleware(){
    return function(req, res, next){
        req.upload = {
            makeEmptyUpload: async function makeEmptyUpload(fileName, type, is_public, permission='contrib'){
                const user = req.session.activeUser;
                const uploadData = {
                    name: fileName,
                    campaign_id: req.campaign.id,
                    user_id: user.id,
                    type: type,
                    is_public: false,
                    permission: permission
                };
                if (is_public && req.checkPermission('gm')){
                    console.log('setting upload public')
                    uploadData.is_public = true;
                }
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

async function fillUsage(upload: UploadModel): Promise<UploadModel>{
    switch(upload.type){
        case 'image': {
            const image = await models.image.findOne({upload_id:upload.id});
            if (image){
                upload.image = image;
                if (image.for_cms){
                    upload.usedFor = {
                        type:'cms',
                        id: image.id,
                        message:`CMS Image ${image.id}`
                    } as UploadUsedFor;
                } else {
                    const attendances = await models.attendance.find({campaign_id: upload.campaign_id, user_id:upload.user_id});
                    for (let attendance of attendances){
                        const event = await models.event.get(attendance.event_id);

                        attendance =  await surveyHelper.fillAttendance(attendance, event);

                        if (event.pre_event_survey_id && attendance.pre_event_survey_response_id ){
                            for (const field of event.pre_event_survey.definition){
                                if (field.type !== 'image') { continue; }
                                if (_.has(attendance.pre_event_data, field.id)){
                                    if (!attendance.pre_event_data[field.id].data){
                                        continue;
                                    }
                                    if (attendance.pre_event_data[field.id].data.id === image.id){
                                        upload.usedFor = {
                                            type:'registration',
                                            id: image.id,
                                            event_id: event.id,
                                            attendance_id: attendance.id,
                                            message:`Registration for ${event.name}`
                                        };
                                        break;
                                    }
                                }
                            }
                        }

                        if (event.post_event_survey_id && attendance.post_event_survey_response_id ){
                            for (const field of event.post_event_survey.definition){
                                if (field.type !== 'image') { continue; }
                                if (_.has(attendance.post_event_data, field.id)){
                                    if (!attendance.post_event_data[field.id].data){
                                        continue;
                                    }
                                    if (attendance.post_event_data[field.id].data.id === image.id){
                                        const campaign = await models.campaign.get(upload.campaign_id);
                                        upload.usedFor = {
                                            type:'post event',
                                            id: image.id,
                                            event_id: event.id,
                                            attendance_id: attendance.id,
                                            message:`${campaign.renames.post_event_survey.singular} for ${event.name}`
                                        };
                                        break;
                                    }
                                }
                            }
                        }

                        const users = await models.user.find(upload.campaign_id);
                        for (const user of users){
                            if (user.image_id === image.id){
                                upload.usedFor = {
                                    type:'user',
                                    id: image.id,
                                    user_id: user.id,
                                    message:`User Image for ${user.name}`
                                };
                                break;
                            }
                        }

                    }
                }
            }
            break;
        }
        case 'font':{
            const font = await models.font.findOne({upload_id:upload.id});
            if (font){
                upload.font = font;
                upload.usedFor = {
                    id: font.id,
                    message:`Font ${font.name}`
                } as UploadUsedFor;
            }
            break;
        }
    }
    return upload;
}

async function updateGalleryImages(campaignId:number, permission:string): Promise<void>{
    const campaign_users = await models.campaign_user.find({campaign_id:campaignId});
    for (const user of campaign_users){
        if (!user.image_id){
            continue;
        }
        const image = await models.image.get(user.image_id);
        if (image.upload.permission !== permission){
            await models.upload.update(image.upload.id, {permission:permission});
        }
    }
}

export default {
    getKey,
    getBucket,
    getUrl,
    sorter,
    getStream,
    getBuffer,
    getSize,
    getContentType,
    signS3,
    uploadCount,
    upload,
    copy,
    remove,
    rename,
    list,
    middleware: uploadMiddleware,
    fillUsage,
    updateGalleryImages
}
