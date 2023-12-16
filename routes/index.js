const express = require('express');
const config = require('config');
const Character = require('../lib/Character');
const fs = require('fs/promises');
const _ = require('underscore');
const async = require('async');

/* GET home page. */
async function showIndex(req, res, next){
    try {

        const rulebookInclude = config.get('rulebook');

        const rulebookAll = JSON.parse(await fs.readFile(__dirname + '/../doc/generated/rulebook.json'));
        const rulebook = {
            children: [],
            files: rulebookAll.files
        };

        for (const child of rulebookAll.children){
            if (_.findWhere(rulebookInclude.children, {id: child.id})){
                rulebook.children.push(child);
            }
        }
        res.locals.rulebook = rulebook;

        const user = req.session.assumed_user ? req.session.assumed_user: req.user;

        if (user && user.type === 'player'){
            const characterData = await req.models.character.findOne({user_id: user.id, active: true});
            if (characterData){
                const character = new Character({id:characterData.id});
                await character.init();
                res.locals.character = await character.data();
            }
        } else if (user && user.type.match(/^(admin|core staff|contributing staff)$/)){
            const characters =  await req.models.character.find({active:true});
            await async.map(characters, async(character) => {
                if (character.user_id){
                    character.user = await req.models.user.get(Number(character.user_id));
                }
                return character;
            });
            res.locals.characters = characters.filter(character => {
                return character.user.type === 'player';
            });
            res.locals.character = null;

        }
    } catch (err) {
        console.trace(err);
    }

    res.locals.siteSection='home';
    res.render('index', { title: 'Ritual Larp' });
}
function showCss(req, res, next){
    res.setHeader('content-type', 'text/css');
    res.send(req.campaign.css);
}

const router = express.Router();

router.get('/', showIndex);
router.get('/css', showCss);

module.exports = router;


