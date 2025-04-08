#!/app/.heroku/node/bin/node
'use strict';
import uploadHelper from '../lib/uploadHelper';
import uploadModel from '../models/upload';
import config from 'config';
const models = {
    upload: uploadModel,
};


(async function main() {
    const uploads = await models.upload.find();
    const cleanupDelta = Number(config.get('upload.cleanupDays')) * 1000*60*60*24;
    for(let upload of uploads as UploadModel[]){
        if ((new Date()).getTime() - (upload.created as Date).getTime() < cleanupDelta){
            continue;
        }
        const bucket = uploadHelper.getBucket(upload);
        if (upload.status === 'new'){
            console.log(`${upload.campaign_id}: ${upload.id}: ${upload.name} is being removed for being incomplete`);
            await models.upload.delete(upload.id);
            await uploadHelper.remove(bucket, uploadHelper.getKey(upload));
            
        } else {
            upload = await uploadHelper.fillUsage(upload);
            if (!upload.usedFor){
                console.log(`${upload.campaign_id}: ${upload.id}: ${upload.name} is being removed for being unused`);
                await models.upload.delete(upload.id);
                await uploadHelper.remove(bucket, uploadHelper.getKey(upload));
                if (upload.type === 'image'){
                    await uploadHelper.remove(bucket, uploadHelper.getKey(upload, {thumbnail:true}));
                }
            }
        }

    }
    
    console.log('done');
    process.exit(0);
})().catch((error) => {
    console.trace(error);
    process.exit(1);
});

