import fs from 'fs/promises';
import userModel from '../models/user';
import campaignModel from '../models/campaign';

const models = {
    user: userModel,
    campaign: campaignModel
};

const campaignId = 8;

(async function main() {
    const campaign = await models.campaign.get(campaignId);
    console.log(`Loading users into ${campaign.name}`);
    const content = (await fs.readFile(__dirname + '/../../emails.txt', 'utf8'));
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
        const user = await models.user.findOne(campaignId, {email:person.email});
        if (user){
            if (user.type === 'none'){
                user.type = 'player';
                await models.user.update(campaignId, user.id, user);
                console.log(`Updated to player for ${person.name}`)
                continue;
            } else {
                console.log(`already has user ${person.name}: ${user.type}`)
                continue;
            }
        }
        await models.user.create(campaignId, {
            name: person.name,
            email: person.email,
            user_type: 'player',
        });
        console.log(`created user for ${person.name}`);

    }
    process.exit(0);

})().catch((error) => {
    process.exitCode = 1;
    console.trace(error)
});
