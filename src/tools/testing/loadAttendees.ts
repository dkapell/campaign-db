import userModel from '../../models/user';
import eventModel from '../../models/event';
import attendanceModel from '../../models/attendance';
import characterModel from '../../models/character';

const models = {
    user: userModel,
    event: eventModel,
    attendance: attendanceModel,
    character: characterModel
};
const eventId = 3;

(async function main() {
    const event = await models.event.get(eventId);
    const users = await models.user.find(event.campaign_id);
    for (const user of users){
        if (user.type === 'none') { continue; }
        const attendance = await models.attendance.findOne({event_id: eventId, user_id: user.id});
        if (attendance) { continue; }
        if (user.type === 'player'){
            const character = await models.character.findOne({campaign_id:event.campaign_id, user_id:user.id, active:true});
            if (!character){
                console.log(`Would not create attendance for ${user.name} because no character`);
                continue;
            } else {
                user.character = character;
            }
        }

        if (getChance(0.8)){

            console.log(`Creating attendance for ${user.name}`)
            await models.attendance.create({
                campaign_id: event.campaign_id,
                event_id: event.id,
                user_id: user.id,
                attending:true,
                character_id: user.character?user.character.id:null,
                notes: 'Created by script'
            });
        } else if (getChance(0.5)){
            console.log(`Creating non attendance for ${user.name}`)
            await models.attendance.create({
                campaign_id: event.campaign_id,
                event_id: event.id,
                user_id: user.id,
                attending:false,
                notes: 'Created by script'
            });

        } else {
            console.log(`Not creating attendance for ${user.name}`)
        }
    }
    process.exit(0);

})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});


function getChance(chance){
    return Math.random() < chance;
}
