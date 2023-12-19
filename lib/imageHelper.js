'use strict';
const _ = require('underscore');
const config = require('config');
const aws = require('aws-sdk');
const models = require('./models');

exports.upload = async function upload(){};

exports.getKey = function getKey(image){
    return ['images', image.id, image.name].join('/');
};

exports.getUrl = function(image){
    const key = exports.getKey(image);
    return`https://${config.get('aws.imageBucket')}.s3.amazonaws.com/${key}`;
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



exports.list = async function list() {
    return new Promise((resolve,reject) => {
        const s3 = new aws.S3({
            accessKeyId: config.get('aws.accessKeyId'),
            secretAccessKey: config.get('aws.secretKey'),
            signatureVersion: 'v4',
        });
        s3.listObjects({
            Bucket: config.get('aws.imageBucket'),
            Prefix: 'images'
        }, function(err, data){
            if (err) reject(err);
            resolve(data.Contents);
        });
    });
};
