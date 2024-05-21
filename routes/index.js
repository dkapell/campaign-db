const express = require('express');
const config = require('config');
const Character = require('../lib/Character');
const _ = require('underscore');
const async = require('async');
const rulebookHelper = require('../lib/rulebookHelper');
const campaignHelper = require('../lib/campaignHelper');

/* GET home page. */
async function showIndex(req, res, next){
    try {

        res.locals.rulebooks =  await rulebookHelper.display(req.campaign.id);

        const user = req.session.assumed_user ? req.session.assumed_user: req.user;

        if (user && user.type === 'player'){
            const characterData = await req.models.character.findOne({user_id: user.id, active: true, campaign_id:req.campaign.id});
            if (characterData){
                const character = new Character({id:characterData.id});
                await character.init();
                res.locals.character = await character.data();
            }
            res.locals.cp = await campaignHelper.cpCalculator(user.id, req.campaign.id);

        } else if (user && user.type.match(/^(admin|core staff|contributing staff)$/)){
            const characters =  await req.models.character.find({active:true, campaign_id:req.campaign.id});
            await async.map(characters, async(character) => {
                if (character.user_id){
                    character.user = await req.models.user.get(req.campaign.id, Number(character.user_id));
                }
                return character;
            });
            res.locals.characters = characters.filter(character => {
                return character.user.type === 'player';
            });
            res.locals.character = null;
            res.locals.cp_grants = await req.models.cp_grant.find({campaign_id:req.campaign.id, approved:false});

        }
    } catch (err) {
        console.trace(err);
    }

    res.locals.siteSection='home';
    res.render('index', { title: req.campaign.name });
}
function showCss(req, res, next){
    res.setHeader('content-type', 'text/css');
    res.send(req.campaign.css);
}

const router = express.Router();

router.get('/', showIndex);
router.get('/css', showCss);

module.exports = router;


