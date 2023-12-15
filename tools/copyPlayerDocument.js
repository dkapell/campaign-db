const Drive = require('../lib/Drive');
const fs = require('fs/promises');
const config = require('config');
const _ = require('underscore');

(async function main() {
    const folders = await Drive.listAll(config.get('drive.folders.playerFolders'), null, true);
    //console.log(folders);
    const templateFolder = _.findWhere(folders.children, {name:'Template Player Folder'});
    const orig = templateFolder.children[0].files[0];
    for(const playerFolder of folders.children){
        if (playerFolder.name === 'Template Player Folder'){ continue; }
        const file = playerFolder.children[0].files[0];
        await Drive.changeOwner(file.id, 'david@rigitech.com');

        //        const replaceName = orig.name.replace(/<name>/i, playerFolder.name);
        //       const replaceFolder = playerFolder.children[0].id;
        //       console.log(`copy ${orig.id} to ${replaceFolder} replacing ${replaceName}`)

        //     await Drive.copyFile(orig.id, replaceFolder, replaceName);
    }



    process.exit(0);
})().catch((error) => {
    console.trace(error);
    process.exit(1);
});

