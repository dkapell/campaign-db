'use strict';
const _ = require('underscore');
const async = require('async');
const config = require('config');
const {google} = require('googleapis');
const {auth} = require('google-auth-library');
const debug = require('debug')('character-db:Drive.js');
const Readable = require('stream').Readable;

class Drive {
    constructor(){
        if (Drive._instance) {
            throw new Error('Singleton classes can\'t be instantiated more than once.');
        }
        Drive._instance = this;

        const keys = config.get('drive.credentials');
        this.google_auth =  auth.fromJSON(config.get('drive.credentials'));
        this.google_auth.scopes = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents'];

        let driveService = google.drive({
            version: 'v3',
            auth: this.google_auth
        });
        let docsService = google.docs({
            version: 'v1',
            auth: this.google_auth
        });

        this.service = {
            files: driveService.files,
            docs: docsService.documents,
            permissions: driveService.permissions

        };
    }

    async _list({
        fileId = config.get('drive.root'),
        pageToken = null,
        recursive = false,
        includeRemoved = false,
        fields = 'nextPageToken, files(id, name, parents, mimeType, modifiedTime)',
        q = '()',
        orderBy = null,
        spaces = 'drive',
        pageSize = 100,
        supportsTeamDrives = false,
        teamDriveId = ''
    } = {}) {
        const self = this;
        q += recursive === false ? `AND ('${fileId}' in parents)` : '';

        const request = {
            fileId,
            pageToken,
            recursive,
            includeRemoved,
            fields,
            q,
            spaces,
            pageSize,
            supportsTeamDrives,
            teamDriveId
        };

        try {
            const response = await self.service.files.list(request);
            debug('Found %s elements', response.data.files.length);
            response.parentFolder = fileId;
            return response.data.files;
        } catch(err){
            debug('Error listing files ', err.message);
            throw err;

        }

    }

    async listFolders(
        parentFolder,
        pageToken,
        recursive,
        includeRemoved,
        fields
    ) {
        return await this._list({
            fileId: parentFolder,
            pageToken,
            recursive,
            includeRemoved,
            fields,
            q: ' (mimeType=\'application/vnd.google-apps.folder\') '
        });
    }

    async listFiles(
        parentFolder,
        pageToken,
        recursive,
        includeRemoved,
        fields
    ) {
        return await this._list({
            fileId: parentFolder,
            pageToken,
            recursive,
            includeRemoved,
            fields,
            q: ' (mimeType!=\'application/vnd.google-apps.folder\') '
        });
    }

    async listAll(parentFolder){
        const self = this;
        if (!_.isObject(parentFolder)){
            parentFolder = {
                id: parentFolder
            };
        }
        const children = await self.listFolders(parentFolder.id);
        parentFolder.files = await self.listFiles(parentFolder.id);
        parentFolder.children = await async.map(children, async (child) => {
            return self.listAll(child);
        });
        return parentFolder;
    }

    async getFileContents(fileId){
        const self = this;
        const request = {
            documentId: fileId
        };
        try {
            const response = await self.service.docs.get(request);
            return response.data;
        } catch(err){
            debug('Error getting contents ', err.message);
            throw err;

        }
    }

    async getText(fileId){
        const self = this;
        const content = await self.getFileContents(fileId);
        const text = [];
        for (const item of content.body.content){
            if (!_.has(item, 'paragraph')){
                continue;
            }
            if (_.has(item.paragraph, 'elements')){
                for (const line of item.paragraph.elements){
                    text.push(line.textRun.content);
                }
            }

        }
        return text;
    }

    async getTextWithFormatting(fileId){
        const self = this;
        const content = await self.getFileContents(fileId);
        const text = [];

        for (const item of content.body.content){
            if (!_.has(item, 'paragraph')){
                continue;
            }
            const paragraph = [];
            if (_.has(item.paragraph, 'elements')){
                for (const line of item.paragraph.elements){
                    paragraph.push(line.textRun);
                }
            }
            text.push(paragraph);
        }
        return text;
    }

    async createFolder(parentId, name){
        const self = this;
        const folders = await self.listFolders(parentId);
        const current = _.findWhere(folders, {name: name});
        if (current){
            return current;
        }

        const request = {
            resource: {
                name: name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId]
            },
            media: {
                mimeType: 'application/vnd.google-apps.folder',
                body: 'folder'
            }
        };
        try {
            const response = await self.service.files.create(request);
            return response.data;
        } catch(err){
            debug('Error creating folder ', err.message);
            throw err;
        }
    }

    async uploadFile(folderId, name, mimeType, contents){
        const self = this;

        const files = await self.listFiles(folderId);

        const current = _.findWhere(files, {name: name});

        const media = {
            mimeType: mimeType,
        };
        if (_.isString(contents)){
            media.body = new Readable();
            media.body.push(contents);
            media.body.push(null);
        } else {
            media.body = contents;
        }


        if (current){
            const request = {
                fileId: current.id,
                media: media
            };

            try {
                const response = await self.service.files.update(request);
                return response.data;
            } catch(err){
                debug('Error uploading file ', err.message);
                throw err;
            }

        } else {
            const request = {
                resource: {
                    name: name,
                    mimeType: mimeType,
                    parents: [folderId]
                },
                media: media
            };

            try {
                const response = await self.service.files.create(request);
                return response.data;
            } catch(err){
                debug('Error uploading file ', err.message);
                throw err;
            }
        }
    }

    async copyFile(fileId, parentId, name){
        const self = this;
        const request = {
            fileId: fileId,
            requestBody: {
                name: name,
                parents: [parentId]
            }
        };
        try {
            const response = await self.service.files.copy(request);
            return response.data;
        } catch(err){
            debug('Error copying file ', err.message);
            throw err;
        }
    }

    async deleteFile(fileId){
        const self = this;
        const request = {
            fileId: fileId
        };
        try {
            const response = await self.service.files.delete(request);
            return response.data;
        } catch(err){
            debug('Error copying file ', err.message);
            throw err;
        }
    }

    async getPermissions(fileId){
        const self = this;
        const request = {
            fileId: fileId,
            fields: '*'
        };
        try {
            const response = await self.service.permissions.list(request);
            return response.data;
        } catch(err){
            debug('Error copying file ', err.message);
            throw err;
        }
    }

    async changeOwner(fileId, email){
        const self = this;
        const request = {
            fileId: fileId,
            transferOwnership: true,
            resource:{
                role: 'owner',
                type: 'user',
                emailAddress: email
            }
        };
        try {
            const response = await self.service.permissions.create(request);
            return response.data;
        } catch(err){
            debug('Error copying file ', err.message);
            throw err;
        }
    }
}


module.exports = new Drive();
