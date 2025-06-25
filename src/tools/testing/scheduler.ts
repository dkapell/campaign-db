import eventModel from '../../models/event';
import sceneModel from '../../models/scene';
import scheduler from '../../lib/scheduler';

const models = {
    event: eventModel,
    scene: sceneModel
};

const eventId = 3;

(async function main() {
    await wait(100);
    await models.event.get(eventId);
    const schedulerData = await scheduler.run(eventId);
    console.log(`Took ${schedulerData.attempts} attempts, with a winning happiness of ${schedulerData.happiness.max} points and left ${schedulerData.unscheduled} scenes unscheduled`);
    for (const scene of schedulerData.schedule.scenes){
        console.log(`${scene.name}: T:[${scene.currentTimeslots.join(', ')}] L:[${scene.currentLocations.join(', ')}] S:${scene.score}`);
        console.log(`    Staff:[${scene.currentStaff.join(', ')}], Players:[${scene.currentPlayers.join(', ')}]`)
    }

    process.exit(0);

})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
