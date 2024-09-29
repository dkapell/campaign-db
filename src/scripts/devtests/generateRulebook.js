const Drive = require('../lib/Drive');
const fs = require('fs/promises');
const config = require('config');
const OUTDIR = __dirname + '/../doc/generated';

(async function main() {
    const rulebook = await Drive.listAll(config.get('rulebook.id'), null, true);
    await prepDir();
    await fs.writeFile(`${OUTDIR}/rulebook.json`, JSON.stringify(rulebook, null, 2));
    console.log('wrote rulebook JSON file');
    process.exit(0);
})().catch((error) => {
    console.trace(error);
    process.exit(1);
});


async function prepDir(){
    if (!await fileExists(OUTDIR)){
        return fs.mkdir(OUTDIR);
    }
}
 
async function fileExists(dir){
    try {
        await fs.access(OUTDIR);
        return true;
    } catch (e){
        return false;
    }
}
