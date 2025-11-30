import Drive from '../lib/Drive'
import userModel from '../models/user';
import campaignModel from '../models/campaign';
const models = {
    user: userModel,
    campaign: campaignModel
};

const templateFolder = '<DRIVE ID>'; //Replace
const folderRoot = '<DRIVE ID>'; //Replace
const playerFolderRegex = /^Sojourn PC:/; //Replace
const campaignId = 0; // Replace

(async function main() {
    const campaign = await models.campaign.get(campaignId);
    console.log(`running on ${campaign.name}`);
    const template = await Drive.listAll(templateFolder);
    const users = (await models.user.find(campaignId)).filter(user => user.type === 'player');

    for (const user of users){
        await createPlayerFolder(user, template);
    }
    process.exit(0);
})().catch((error) => {
    process.exitCode = 1;
    console.trace(error)
});


async function createPlayerFolder(user, template){
    console.log(`Creating .../${user.name} under player root`)
    const playerFolder = await Drive.createFolder(folderRoot, user.name);
    user.staff_drive_folder = `https://drive.google.com/drive/u/0/folders/${playerFolder.id}`;
    for (const file of template.files){
        const fileName = file.name.replace(/<name>/i, user.name);
        await Drive.copyFile(file.id, playerFolder.id, fileName);
    }
    for (const child of template.children){
        const childName = child.name.replace(/<name>/i, user.name);
        const childId = await copyFolder(child.id, playerFolder.id, childName, user);
        if (childName.match(playerFolderRegex)){
            user.drive_folder = `https://drive.google.com/drive/u/0/folders/${childId}`;
            await Drive.shareFile(childId, user.email, false);
        }
    }
    await models.user.update(campaignId, user.id, {
        drive_folder: user.drive_folder,
        staff_drive_folder: user.staff_drive_folder
    });
}


async function copyFolder(sourceId, parentId, folderName, user){
    const target = await Drive.createFolder(parentId, folderName);
    const sourceData = await Drive.listAll(sourceId);
    for (const file of sourceData.files){
        const fileName = file.name.replace(/<name>/i, user.name);
        await Drive.copyFile(file.id, target.id, fileName);
    }
    for (const child of sourceData.children){
        const childName = child.name.replace(/<name>/i, user.name);
        await copyFolder(child.id, target.id, childName, user);
    }
    return target.id;
}

