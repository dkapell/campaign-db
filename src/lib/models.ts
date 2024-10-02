'use strict';
import fs from 'fs';
import path from 'path';
import database from './database';
import async from 'async';

const models:Models = {database: database};

const modelDir = '../models';

(async () => {
    await loadModels(__dirname + '/' + modelDir);
})();

async function loadModels(dir:string){
    await async.each(fs.readdirSync(dir), async function(filename){
        if (filename.match(/\.js$/)){
            const modelName = path.basename(filename, '.js');
            const model = await import(dir + '/' + filename);
            models[modelName] = model.default;
        }
    });
}

export default models;
