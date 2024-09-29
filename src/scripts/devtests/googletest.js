const config = require('config');
const Drive = require('../../lib/Drive');
const pdfLayout = require('../../lib/pdfLayout.js');
const _ = require('underscore');

async function ExampleOperations() {

    // List Folders under the root folder
    // let folderResponse = await Drive.listFolders( config.get('drive.root'));
 
    // console.log({ folders: folderResponse });
 

    // Create a folder under your root folder
    /*
    let newFolder = { name: 'folder_example' + Date.now() },
        createFolderResponse = await googleDriveInstance.createFolder(
            YOUR_ROOT_FOLDER,
            newFolder.name
        );
 
    newFolder.id = createFolderResponse.id;
 
    debug(`Created folder ${newFolder.name} with id ${newFolder.id}`);
    */

    const outputFolder = await Drive.createFolder(config.get('drive.root'), 'Output');
 
    // List files under your root folder.
    let listFilesResponse = await Drive.listFiles(config.get('drive.root'));
 
    const file = _.findWhere(listFilesResponse.reverse(), {mimeType: 'application/vnd.google-apps.document'});
    if (file){

        const text = await Drive.getTextWithFormatting( file.id );

        const pdf = pdfLayout.render(_.pluck(text[0], 'content').join(''), text, {
            font:'Akahake',
            border: true
        });

        await Drive.uploadFile(outputFolder.id, `${file.name}.pdf`, 'application/pdf', pdf );
    }


}
 
ExampleOperations();
