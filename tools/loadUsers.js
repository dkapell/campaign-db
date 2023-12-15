const _ = require('underscore');
const config = require('config');
const models = require('../lib/models');
const fs = require('fs/promises');


(async function main() {
    const content = (await fs.readFile(__dirname + '/../emails.txt')).toString();
    const lines = content.split(/\n/);
    const users = [];
    for (const line of lines){
        if (line === ''){
            continue;
        }
        const parts = line.split(/\|/);
        users.push({name:parts[0], email:parts[1].replace(/\s+/, '')});
    }
    for (const person of users){
        const user = await models.user.findOne({email:person.email});
        if (user) {
            continue;
        }
        await models.user.create({
            name: person.name,
            email: person.email,
            user_type: 'player',
        });
        console.log('created user for ' + person.name);

    }
    process.exit(0);

})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});
