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
    let scenes = (await models.scene.find({campaign_id: event.campaign_id, status:'ready'})).filter(scene => {
        return !scene.event_id || scene.event_id === eventId;
    });
    scenes = await scheduler.scoreScenes(scenes);

    for (const scene of scenes){
        console.log(`${scene.name}: ${scene.score}`)
    }


    process.exit(0);

})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});


function getChance(chance){
    return Math.random() < chance;
}
