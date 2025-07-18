import express from 'express';
import _ from 'underscore';
import permission from '../lib/permission';
import querystring from 'querystring';
import glossaryHelper from '../lib/glossaryHelper';

/* GET glossary listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Glossary'
    };
    try {
        const glossary_entries = await req.models.glossary_entry.find({campaign_id: req.campaign.id});
        res.locals.glossary_entries = await glossaryHelper.prepEntries(glossary_entries, req.checkPermission('contrib'), req.campaign.id);
        res.locals.sortEntries = glossaryHelper.sorter;
        res.locals.wideMain = true;
        res.locals.listName = 'All Entries';
        res.locals.listType = 'all';
        res.locals.reviewReady = await glossaryHelper.reviewReady(req.campaign.id);
        res.locals.title += ' - Glossary';
        res.render('glossary/list');
    } catch (err){
        next(err);
    }
}

async function listTag(req, res, next){
    const tagId = req.params.id;
    try{
        const tag = await req.models.tag.get(tagId);
        if (tag.campaign_id !== req.campaign.id){
            throw new Error('Can not get entries from different campaign');
        }
        if (tag.type !== 'glossary'){
            throw new Error('Invalid tag type');
        }

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/glossary', name: 'Glossary'},
            ],
            current: `Tag: ${tag.name}`
        };

        const glossary_entries = await req.models.glossary_entry.listByTag(tagId);
        res.locals.glossary_entries = await glossaryHelper.prepEntries(glossary_entries, req.checkPermission('contrib'), req.campaign.id);
        res.locals.tag = tag;
        res.locals.sortEntries = glossaryHelper.sorter;
        res.locals.wideMain = true;
        res.locals.listName = `Tag: ${tag.name}`;
        res.locals.listType = 'tag';
        res.locals.reviewReady = await glossaryHelper.reviewReady(req.campaign.id);
        res.locals.title += ` - Glossary - ${tag.name}`;
        res.render('glossary/list');
    } catch (err){
        next(err);
    }
}

async function listStatus(req, res, next){
    const statusName = req.params.status;
    try{
        res.locals.sortEntries = glossaryHelper.sorter;
        res.locals.wideMain = true;

        const status = await req.models.glossary_status.findOne({name:statusName, campaign_id:req.campaign.id});
        if (!status){
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/glossary', name: 'Glossary'},
                ],
                current: 'Invalid Status'
            };
            res.locals.glossary_entries = [];
            res.locals.glossary_status = {name: 'Not Found'};
            res.locals.reviewReady = await glossaryHelper.reviewReady(req.campaign.id);
            return res.render('glossary/list');

        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/glossary', name: 'Glossary'},
            ],
            current: `Status: ${res.locals.capitalize(status.name)}`
        };

        const glossary_entries = await req.models.glossary_entry.find({status_id:status.id});
        res.locals.glossary_entries = await glossaryHelper.prepEntries(glossary_entries, req.checkPermission('contrib'), req.campaign.id);
        res.locals.glossary_status = status;
        res.locals.listName = `Status: ${res.locals.capitalize(status.name)}`;
        res.locals.listType = 'status';
        res.locals.reviewReady = await glossaryHelper.reviewReady(req.campaign.id);
        res.locals.title += ` - Glossary - ${res.locals.capitalize(status.name)}`;
        res.render('glossary/list');
    } catch (err){
        next(err);
    }
}

async function listReview(req, res, next){
    try{
        res.locals.sortEntries = glossaryHelper.sorter;
        res.locals.wideMain = true;

        const statuses = await req.models.glossary_status.find({reviewable:true, campaign_id:req.campaign.id});
        if (!statuses.length){
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/glossary', name: 'Glossary'},
                ],
                current: 'Reviews'
            };
            res.locals.glossary_entries = [];
            res.locals.glossary_status = {name: 'Not Found'};
            res.locals.reviewReady = await glossaryHelper.reviewReady(req.campaign.id);
            return res.render('glossary/list');

        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/glossary', name: 'Glossary'},
            ],
            current: 'Reviewable'
        };

        const glossary_entries = [];
        for (const status of statuses){
            glossary_entries.push( await req.models.glossary_entry.find({status_id:status.id}));
        }

        res.locals.glossary_entries = await glossaryHelper.prepEntries(_.flatten(glossary_entries, true), req.checkPermission('contrib'), req.campaign.id);
        res.locals.listName = 'Reviewable';
        res.locals.listType = 'status';
        res.locals.reviewReady = await glossaryHelper.reviewReady(req.campaign.id);
        res.locals.title += ' - Glossary - Reviewable';
        res.render('glossary/list');
    } catch (err){
        next(err);
    }
}

async function search(req, res, next){
    const query = req.query.query;
    try{
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/glossary', name: 'Glossary'},
            ],
            current: 'Search'
        };

        const glossary_entries = await req.models.glossary_entry.search(req.campaign.id, query);
        res.locals.glossary_entries = await glossaryHelper.prepEntries(glossary_entries, req.checkPermission('contrib'), req.campaign.id);
        res.locals.searchQuery = query;
        res.locals.sortEntries = glossaryHelper.sorter;
        res.locals.wideMain = true;
        res.locals.listName = 'Search Results';
        res.locals.listType = 'search';
        res.locals.reviewReady = await glossaryHelper.reviewReady(req.campaign.id);
        res.locals.title += ' - Glossary - Search Results';
        res.render('glossary/list');
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const glossary_entry = await req.models.glossary_entry.get(id);
        if (!glossary_entry || glossary_entry.campaign_id !== req.campaign.id){
            throw new Error('Invalid Glossary Entry');
        }
        if (!(req.checkPermission('gm') || (glossary_entry.status && glossary_entry.status.display_to_pc))){
            req.flash('warning', 'No permission to view this entry');
            return res.redirect('/glossary');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/glossary', name: 'Glossary'},
            ],
            current: glossary_entry.name
        };
        if (glossary_entry.content){
            glossary_entry.content = {
                anchor: await glossaryHelper.format(glossary_entry.content, true, req.checkPermission('contrib'), [], req.campaign.id),
                entry: await glossaryHelper.format(glossary_entry.content, false, req.checkPermission('contrib'), [], req.campaign.id),
            };
        }
        res.locals.glossary_entry = glossary_entry;
        res.locals.title += ` - Glossary - ${glossary_entry.name}`;
        res.render('glossary/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        res.locals.glossary_entry = {
            name: req.query.name ? req.query.name : null,
            contents: null,
            type: 'in character',
            status_id: null,
            tags: []
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/glossary', name: 'Glossary'},
            ],
            current: 'New'
        };

        res.locals.glossary_statuses = await req.models.glossary_status.find({campaign_id:req.campaign.id});
        res.locals.tags = await req.models.tag.find({campaign_id:req.campaign.id, type:'glossary'});

        if (_.has(req.session, 'glossary_entryData')){
            res.locals.glossary_entry = req.session.glossary_entryData;
            delete req.session.glossary_entryData;
        }
        res.locals.title += ' - New Glossary Entry';
        res.render('glossary/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;

    try{
        const glossary_entry = await req.models.glossary_entry.get(id);
        if (!glossary_entry || glossary_entry.campaign_id !== req.campaign.id){
            throw new Error('Invalid Glossary Entry');
        }
        res.locals.glossary_entry = glossary_entry;
        if (_.has(req.session, 'glossary_entryData')){
            res.locals.glossary_entry = req.session.glossary_entryData;
            delete req.session.glossary_entryData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/glossary', name: 'Glossary'},
            ],
            current: 'Edit: ' + glossary_entry.name
        };
        res.locals.glossary_statuses = await req.models.glossary_status.find({campaign_id:req.campaign.id});
        res.locals.tags = await req.models.tag.find({campaign_id:req.campaign.id, type:'glossary'});
        res.locals.title += ` - Edit Glossary Entry - ${glossary_entry.name}`;
        res.render('glossary/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res){
    const glossary_entry = req.body.glossary_entry;
    if (!glossary_entry.tags){
        glossary_entry.tags = [];
    } else if(!_.isArray(glossary_entry.tags)){
        glossary_entry.tags = [glossary_entry.tags];
    }
    if (glossary_entry.status_id === ''){
        glossary_entry.status_id = null;
    }
    glossary_entry.tags = glossary_entry.tags.map(tag => {
        if (!isNaN(tag)){
            return Number(tag);
        }
        return tag;
    });

    req.session.glossary_entryData = glossary_entry;
    glossary_entry.campaign_id = req.campaign.id;

    try{
        const id = await req.models.glossary_entry.create(glossary_entry);
        await req.audit('glossary_entry', id, 'create', {new:glossary_entry});
        delete req.session.glossary_entryData;
        req.flash('success', 'Created Entry ' + glossary_entry.name);
        res.redirect('/glossary');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/glossary/new');
    }
}

async function update(req, res){
    const id = req.params.id;
    const glossary_entry = req.body.glossary_entry;

    if (!glossary_entry.tags){
        glossary_entry.tags = [];
    } else if(!_.isArray(glossary_entry.tags)){
        glossary_entry.tags = [glossary_entry.tags];
    }
    if (glossary_entry.status_id === ''){
        glossary_entry.status_id = null;
    }
    glossary_entry.tags = glossary_entry.tags.map(tag => {
        if (!isNaN(tag)){
            return Number(tag);
        }
        return tag;
    });
    req.session.glossary_entryData = glossary_entry;

    try {
        const current = await req.models.glossary_entry.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not edit record from different campaign');
        }

        glossary_entry.campaign_id = req.campaign.id;

        await req.models.glossary_entry.update(id, glossary_entry);
        await req.audit('glossary_entry', id, 'update', {old: current, new:glossary_entry});
        delete req.session.glossary_entryData;
        req.flash('success', 'Updated Entry ' + glossary_entry.name);
        res.redirect('/glossary');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/glossary/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.glossary_entry.get(id);
        if (current.campaign_id !== req.campaign.id){
            throw new Error('Can not delete record from different campaign');
        }
        await req.models.glossary_entry.delete(id);
        await req.audit('glossary_entry', id, 'delete', {old: current});
        req.flash('success', `Removed Entry ${current.name}`);
        res.redirect('/glossary');
    } catch(err) {
        return next(err);
    }
}

async function renderPreview(req, res){
    const content = req.body.content;
    try {
        res.json({
            success:true,
            content: await glossaryHelper.format(content, true, req.checkPermission('gm'), [], req.campaign.id)
        });
    } catch (err){
        res.json({success:false, error:err});
    }
}

const router = express.Router();

router.use(permission());
router.use(function(req, res, next){
    res.locals.siteSection='setting';
    res.locals.querystring = querystring;
    if (req.campaign.display_glossary === 'private'){
        return permission('player')(req, res, next);
    }
    if (req.campaign.display_glossary === 'disabled'){
        req.flash('warning', 'Glossary is disabled')
        return res.redirect('/');
    }
    next();
});

router.get('/', list);
router.get('/new', permission('gm'), showNew);
router.get('/search', search);
router.get('/review', permission('contrib'), listReview);
router.get('/tag/:id*', listTag);
router.get('/status/:status', permission('contrib'), listStatus);
router.get('/:id/edit', permission('gm'), showEdit);
router.get('/:id*', show);
router.post('/', permission('gm'), create);
router.post('/preview', permission('gm'), renderPreview);
router.put('/:id', permission('gm'), update);
router.delete('/:id', permission('gm'), remove);

export default router;
