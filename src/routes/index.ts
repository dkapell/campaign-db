import express from 'express';
import Character from '../lib/Character';
import async from 'async';
import _ from 'underscore';
import rulebookHelper from '../lib/rulebookHelper';
import campaignHelper from '../lib/campaignHelper';

/* GET home page. */
async function showIndex(req, res){
    try {

        res.locals.rulebooks =  await rulebookHelper.display(req.campaign.id);

        const user = req.session.activeUser;

        const events = await req.models.event.find({campaign_id:req.campaign.id, deleted:false});
        const futureEvents = events.filter( event => { return event.end_time > new Date(); })
        const pastEvents = events.filter( event => { return event.end_time <= new Date(); })

        res.locals.showTasks = false;
        if (req.campaign.display_gallery && user && !user.image_id){
            res.locals.showTasks = true;
        }

        let post_event_surveys = []
        if (user){
            post_event_surveys = await campaignHelper.getPostEventSurveys(user.id, pastEvents);
        }
        res.locals.post_event_surveys = post_event_surveys.filter( survey => {return !survey.post_event_submitted && !survey.hidden});

        if (res.locals.post_event_surveys.length){
            res.locals.showTasks = true;
        }
        res.locals.pending_cp_grants = Number(await req.models.cp_grant.count({campaign_id:req.campaign.id, status:'pending'}));

        // User is a Player - show my cp grants, events, current character
        if (user && (user.type === 'player' || req.session.player_mode) && !req.session.admin_mode){
            const characterData = await req.models.character.findOne({user_id: user.id, active: true, campaign_id:req.campaign.id});
            if (characterData){
                const character = new Character({id:characterData.id});
                await character.init();
                res.locals.character = await character.data();
            }
            res.locals.cp = await campaignHelper.cpCalculator(user.id, req.campaign.id);
            res.locals.events = futureEvents.map(event => {
                event.attendees = _.where(event.attendees, {user_id: user.id});
                return event;
            });

        // User is Contributing Staff or higher - show pending CP grants, events, active player characters
        } else if (user && (user.site_admin || user.type.match(/^(admin|core staff|contributing staff)$/))){
            const characters =  await req.models.character.find({active:true, campaign_id:req.campaign.id});
            await async.map(characters, async(character) => {
                if (character.user_id){
                    character.user = await req.models.user.get(req.campaign.id, Number(character.user_id));
                }
                return character;
            });
            res.locals.characters = characters.filter((character) => {
                return character.user.type === 'player';
            });
            res.locals.character = null;
            res.locals.events = futureEvents;

        // User is Event Staff - no CP Grants, show events, owned characters
        } else {
            res.locals.cp = null

            if (user){
                const characters = await req.models.character.find({user_id: user.id, active: true, campaign_id:req.campaign.id});
                await async.map(characters, async(character) => {
                    if (character.user_id){
                        character.user = await req.models.user.get(req.campaign.id, Number(character.user_id));
                    }
                    return character;
                });
                res.locals.characters = characters
                res.locals.events = futureEvents.map(event => {
                    event.attendees = _.where(event.attendees, {user_id: user.id});
                    return event;
                });
            } else {
                res.locals.characters = [];
                res.locals.events = futureEvents;
            }
        }
        if (req.checkPermission('gm, cp grant') && res.locals.pending_cp_grants && req.campaign.display_cp){
            res.locals.showTasks = true;
        }


    } catch (err) {
        console.trace(err);
    }

    res.locals.siteSection='home';
    res.render('index', { title: req.campaign.name });
}
function showCss(req, res){
    res.setHeader('content-type', 'text/css');
    res.send(req.campaign.css);
}

const router = express.Router();

router.get('/', showIndex);
router.get('/css', showCss);

export default router;


