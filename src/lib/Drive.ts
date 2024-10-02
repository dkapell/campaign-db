'use strict';
import _ from 'underscore';
import async from 'async';
import config from 'config';
import { docs_v1, drive_v3, google } from 'googleapis';
import {Readable} from 'stream';
import { auth, GoogleAuth } from 'google-auth-library';

class Drive {
    private static _instance:Drive;
    google_auth: GoogleAuth;
    service: {
        files: drive_v3.Resource$Files,
        docs: docs_v1.Resource$Documents,
        permissions: drive_v3.Resource$Permissions
    }

    constructor(){

        if (Drive._instance) {
            throw new Error('Singleton classes can\'t be instantiated more than once.');
        }
        Drive._instance = this;

        const credentials = config.get('drive.credentials');

        const client = auth.fromJSON(credentials);
        //client.scopes = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents'];

        this.google_auth = client as unknown as GoogleAuth;

        const driveService = google.drive({
            version: 'v3',
            auth: this.google_auth
        });
        const docsService = google.docs({
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
            teamDriveId,
            orderBy
        };

        try {
            const response = await this.service.files.list(request);
            console.log(`Found ${response.data.files.length} elements`);
            return response.data.files;
        } catch(err){
            console.error(`Error listing files: ${err.message}`);
            throw err;

        }

    }

    async listFolders(
        parentFolder:string,
        pageToken?:string,
        recursive?:boolean,
        includeRemoved?:boolean,
        fields?:string
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
        parentFolder:string,
        pageToken?:string,
        recursive?:boolean,
        includeRemoved?:boolean,
        fields?:string
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
        if (!_.isObject(parentFolder)){
            parentFolder = {
                id: parentFolder
            };
        }
        const children = await this.listFolders(parentFolder.id);
        parentFolder.files = await this.listFiles(parentFolder.id);
        parentFolder.children = await async.map(children, async (child) => {
            return this.listAll(child);
        });
        return parentFolder;
    }

    async getFileContents(fileId){
        const request = {
            documentId: fileId
        };
        try {
            const response = await this.service.docs.get(request);
            return response.data;
        } catch(err){
            console.error(`Error getting contents: ${err.message}`);
            throw err;

        }
    }

    async getText(fileId){
        const content = await this.getFileContents(fileId);
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

    async getTextWithFormatting(fileId:string){
        const content = await this.getFileContents(fileId);
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

    async createFolder(parentId:string, name:string){
        const folders = await this.listFolders(parentId);
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
            const response = await this.service.files.create(request);
            return response.data;
        } catch(err){
            console.error(`Error creating folder: ${err.message}`);
            throw err;
        }
    }

    async uploadFile(folderId:string, name:string, mimeType:string, contents: string|Buffer|Readable){
        const files = await this.listFiles(folderId);

        const current = _.findWhere(files, {name: name});

        const media = {
            mimeType: mimeType,
            body:null
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
                const response = await this.service.files.update(request);
                return response.data;
            } catch(err){
                console.error(`Error uploading file: ${err.message}`);
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
                const response = await this.service.files.create(request);
                return response.data;
            } catch(err){
                console.error(`Error uploading file: ${err.message}`);
                throw err;
            }
        }
    }

    async copyFile(fileId, parentId, name){
        const request = {
            fileId: fileId,
            requestBody: {
                name: name,
                parents: [parentId]
            }
        };
        try {
            const response = await this.service.files.copy(request);
            return response.data;
        } catch(err){
            console.error(`Error copying file: ${err.message}`);
            throw err;
        }
    }

    async deleteFile(fileId){
        const request = {
            fileId: fileId
        };
        try {
            const response = await this.service.files.delete(request);
            return response.data;
        } catch(err){
            console.error(`Error copying file: ${err.message}`);
            throw err;
        }
    }

    async getPermissions(fileId){
        const request = {
            fileId: fileId,
            fields: '*'
        };
        try {
            const response = await this.service.permissions.list(request);
            return response.data;
        } catch(err){
            console.error(`Error copying file: ${err.message}`);
            throw err;
        }
    }

    async changeOwner(fileId, email){
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
            const response = await this.service.permissions.create(request);
            return response.data;
        } catch(err){
            console.error(`Error copying file: ${err.message}`);
            throw err;
        }
    }
}

export = new Drive();
