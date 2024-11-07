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

        const user = req.session.assumed_user ? req.session.assumed_user: req.user;

        if (req.session.player_mode){
            user.type = 'player';
        }
        if (user && user.type === 'player' && !user.site_admin){
            const characterData = await req.models.character.findOne({user_id: user.id, active: true, campaign_id:req.campaign.id});
            if (characterData){
                const character = new Character({id:characterData.id});
                await character.init();
                res.locals.character = await character.data();
            }
            res.locals.cp = await campaignHelper.cpCalculator(user.id, req.campaign.id);
            res.locals.cp_grants = await req.models.cp_grant.find({campaign_id:req.campaign.id, approved:false, user_id:user.id});
            let events = await req.models.event.find({campaign_id:req.campaign.id});
            events = events.filter( event => { return event.end_time > new Date(); })
            res.locals.events = events.map(event => {
                event.attendees = _.where(event.attendees, {user_id: user.id});
                return event;
            });


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
            res.locals.cp_grants = await req.models.cp_grant.find({campaign_id:req.campaign.id, approved:false});
            const events = await req.models.event.find({campaign_id:req.campaign.id});
            res.locals.events = events.filter( event => { return event.end_time > new Date(); })

        } else {
            const characters = await req.models.character.find({user_id: user.id, active: true, campaign_id:req.campaign.id});
            await async.map(characters, async(character) => {
                if (character.user_id){
                    character.user = await req.models.user.get(req.campaign.id, Number(character.user_id));
                }
                return character;
            });
            res.locals.characters = characters
            res.locals.cp = null
            res.locals.cp_grants = []
            let events = await req.models.event.find({campaign_id:req.campaign.id});
            events = events.filter( event => { return event.end_time > new Date(); })
            console.log(events)
            res.locals.events = events.map(event => {
                event.attendees = _.where(event.attendees, {user_id: user.id});
                return event;
            });

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


