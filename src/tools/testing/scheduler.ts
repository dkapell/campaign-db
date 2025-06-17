import _ from 'underscore';
import eventModel from '../../models/event';
import sceneModel from '../../models/scene';
import scheduler from '../../lib/scheduler';
import scheduleHelper from '../../lib/scheduleHelper';

const models = {
    event: eventModel,
    scene: sceneModel
};

const eventId = 3;

(async function main() {
    const event = await models.event.get(eventId);
    const scenes = (await models.scene.find({campaign_id: event.campaign_id, status:'ready'})).filter(scene => {
        return !scene.event_id || scene.event_id === eventId;
    });
    const schedule = await scheduler.run(eventId, scenes);

    for (const timeslot of schedule){
        console.log(`${timeslot.name}: ${_.pluck(timeslot.scenes, 'name').join(', ')}`)
    }


    process.exit(0);

})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});


function getChance(chance){
    return Math.random() < chance;
}
