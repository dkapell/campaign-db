import express from 'express';
import _ from 'underscore';
import permission from '../lib/permission';

/* GET skill_statuss listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Character Fields'
    };
    try {
        res.locals.custom_fields = await req.models.custom_field.find({campaign_id:req.campaign.id, location:'character'});
        res.locals.title += ' - Character Fields';
        res.render('character_field/list', { pageTitle: 'Character Fields' });
    } catch (err){
        next(err);
    }
}


async function showNew(req, res, next){
    try{
        if (req.query.clone){
            const custom_field = await req.models.custom_field.get(req.query.clone);
            if (!custom_field || custom_field.campaign_id !== req.campaign.id || custom_field.location !== 'character'){
                throw new Error ('Invalid Character Field');
            }
            delete custom_field.id;
            res.locals.custom_field = custom_field;
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/character_field', name: 'Character Fields'}
                ],
                current: `Clone: ${custom_field.name}`
            };
            res.locals.title += `Clone Character Field - ${custom_field.name}`;
        } else {

            res.locals.custom_field = {
                name: null,
                description: null,
                type: null,
                display_to_pc: false,
                editable_by_pc: false,
                configuration: {},
                location: 'character'
            };
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/character_field', name: 'Character Fields'}
                ],
                current: 'New'
            };
            res.locals.title += ' - New Character Field';
        }

        if (_.has(req.session, 'character_fieldData')){
            res.locals.custom_field = req.session.character_fieldData;
            delete req.session.character_fieldData;
        }
        res.locals.images = await req.models.image.find({campaign_id:req.campaign.id, type:'content'});
        res.render('character_field/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;

    try{
        const custom_field = await req.models.custom_field.get(id);
        if (!custom_field || custom_field.campaign_id !== req.campaign.id || custom_field.location !== 'character'){
            throw new Error('Invalid Custom Field');
        }
        res.locals.custom_field = custom_field;
        if (_.has(req.session, 'character_fieldData')){
            res.locals.custom_field = req.session.character_fieldData;
            delete req.session.character_fieldData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/character_field', name: 'Character Fields'}
            ],
            current: 'Edit: ' + custom_field.name
        };
        res.locals.images = await req.models.image.find({campaign_id:req.campaign.id, type:'content'});
        res.locals.title += ` - Edit Character Field - ${custom_field.name}`;
        res.render('character_field/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const custom_field = req.body.custom_field;

    req.session.character_fieldData = custom_field;

    for (const field of ['display_to_pc', 'editable_by_pc', 'required']){
        if (!_.has(custom_field, field)){
            custom_field[field] = false;
        }
    }

    custom_field.campaign_id = req.campaign.id;
    custom_field.location = 'character';
    custom_field.configuration = parseCustomField(custom_field);

    try{
        const custom_fields = await req.models.custom_field.find({campaign_id:req.campaign.id, location:'character'});
        const maxVal = _.max(_.pluck(custom_fields, 'display_order'));
        custom_field.display_order = _.isFinite(maxVal)?maxVal + 1:1;

        const id = await req.models.custom_field.create(custom_field);
        await req.audit('custom_field', id, 'create', {new:custom_field});
        delete req.session.character_fieldData;
        req.flash('success', 'Created Character Field ' + custom_field.name);
        res.redirect('/character_field');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/character_field/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const custom_field = req.body.custom_field;
    req.session.character_fieldData = custom_field;

    for (const field of ['display_to_pc', 'editable_by_pc', 'required']){
        if (!_.has(custom_field, field)){
            custom_field[field] = false;
        }
    }
    custom_field.location = 'character';
    custom_field.configuration = parseCustomField(custom_field);

    try {
        const current = await req.models.custom_field.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }
        if (current.location !== 'character'){
            throw new Error('Can not edit non-character custom field');
        }
        await req.models.custom_field.update(id, custom_field);
        await req.audit('custom_field', id, 'update', {old: current, new:custom_field});
        delete req.session.character_fieldData;
        req.flash('success', 'Updated Character Field ' + custom_field.name);
        res.redirect('/character_field');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/character_field/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.custom_field.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        if (current.location !== 'character'){
            throw new Error('Can not delete non-character custom field');
        }
        await req.models.custom_field.delete(id);
        await req.audit('custom_field', id, 'delete', {old: current});
        req.flash('success', 'Removed Character Field');
        res.redirect('/character_field');
    } catch(err) {
        return next(err);
    }
}

async function reorder(req, res, next){
    try {
        for (const update of req.body){
            const custom_field = await req.models.custom_field.get(update.id);
            if (!custom_field || custom_field.campaign_id !== req.campaign.id || custom_field.location !== 'character'){
                throw new Error ('Invalid record');
            }
            custom_field.display_order = update.display_order;
            await req.models.custom_field.update(update.id, custom_field);
        }
        res.json({success:true});
    }catch (err) {
        return next(err);
    }
}

interface CustomFieldOption{
    id: string|number,
    value: string,
    sort_order: number
    description?: string,
}

interface CustomFieldConfiguration{
    options?:CustomFieldOption[],
    rows?:number
}

function parseCustomField(data){
    const configuration:CustomFieldConfiguration = {}
    switch (data.type){
        case 'dropdown':
            configuration.options = [];
            for (const id in data.configuration.options){
                if (id === 'new'){
                    continue;
                }
                const option = data.configuration.options[id];
                configuration.options.push(option);
            }
            configuration.options = configuration.options.sort( (a, b) => {
                return Number(a.sort_order) - Number(b.sort_order);
            });
            break;
        case 'longtext':
            configuration.rows = Number(data.configuration.rows);
            break;
    }
    return configuration;
}

const router = express.Router();

router.use(permission('gm'));
router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.get('/', list);
router.get('/new', showNew);
router.get('/:id', showEdit);
router.get('/:id/edit', showEdit);
router.post('/', create);
router.put('/order', reorder);
router.put('/:id', update);
router.delete('/:id', permission('admin'), remove);

export default router;
