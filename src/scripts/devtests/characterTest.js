const _ = require('underscore');
const config = require('config');

const Character = require('../lib/Character');


(async function main() {
    const character = new Character({
        id:33
    });
    await character.init();
    //await character.addSkill(420);
    //await character.addSource(14);
    //await character.removeSkill(195);
    //await character.updateSkillDetails(166, {trait:'Humor'});
    const data = await character.data();

    /*
    console.log('** Current Skills **');
    for (const skill of data.skills){
        console.log(`${skill.id}: ${skill.character_skill_id}: ${skill.source.name}: ${skill.name}: ${skill.character_cost}: ${skill.removable}`);
    }
    */

    console.log('** Current Sources **');
    for (const source of data.sources){
        console.log(`${source.id}: ${source.type.name}: ${source.name}: ${source.character_cost}: ${source.removable}`);
    }

    // console.log(await character.cp());

    //await character.rebuildCP();
    //const newdata = await character.data();

    //console.log('** Current Skills **');
    //for (const skill of newdata.skills){
    //    console.log(`${skill.id}: ${skill.character_skill_id}: ${skill.source.name}: ${skill.name}: ${skill.character_cost}: ${skill.removable}`);
    // }

    //console.log(await character.cp());



    /*
    const skills = await character.possibleSkills();
    console.log('\n** Possible Skills **');
    for (const skill of skills){
        console.log(`${skill.id}: ${skill.source.name}: ${skill.usage.name} ${skill.name}: ${skill.next_cost}`);
    }*/


    const sources = await character.possibleSources();
    console.log('\n** Possible Headers **');
    for (const source of sources){
        console.log(`${source.id}: ${source.type.name}: ${source.name}: ${source.cost}`);
    }

    /*
    for (const source of data.sources){
        console.log(`${source.id}: ${source.type.name}: ${source.name}: ${source.cost}: ${source.removable}`);
    }
*/

    process.exit(0);

})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});


