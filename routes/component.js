const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET component listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/ritual', name: 'Ritual'},
        ],
        current: 'Components'
    };
    try {
        const components =  await req.models.component.list();
        res.locals.components = _.groupBy(components, 'type');
        res.locals.component_types = _.indexBy(await req.models.component_type.list(), 'name');
        res.locals.title += ' - Components';
        res.render('component/list', { pageTitle: 'Components' });

    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;

    try {
        const component = await req.models.component.get(id);
        if (!component){
            return res.status(404);
        }
        const children = await req.models.component.find({parent_id: component.id});
        component.children = {};
        for (const child of children){
            if (!_.has(component.children, child.type)){
                component.children[child.type] = [];
            }
            component.children[child.type].push(child);
        }
        res.locals.component = component;
        res.locals.component_types = _.indexBy(await req.models.component_type.list(), 'name');

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/ritual', name: 'Ritual'},
                { url: '/component', name: 'Components'},
            ],
            current: component.type + ': ' + component.name
        };
        const path = await makeComponentPath([], component.parent_id, req);
        res.locals.title += ` - Component - ${component.name}`;
        res.locals.breadcrumbs.path = res.locals.breadcrumbs.path.concat(path);


        res.render('component/show');
    } catch (err){
        next(err);
    }

}

async function showNew(req, res, next){
    res.locals.component = {
        name: null,
        type: req.query.type ? req.query.type : null,
        maximum: 1,
        multiple_only: false,
        parent_id: req.query.parent_id ? req.query.parent_id : null,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/ritual', name: 'Ritual'},
            { url: '/component', name: 'Components'},
        ],
        current: 'New'
    };
    const path = await makeComponentPath([], Number(req.query.parent_id), req);
    res.locals.breadcrumbs.path = res.locals.breadcrumbs.path.concat(path);


    res.locals.component_types = await req.models.component_type.list();
    res.locals.components =  _.groupBy(await req.models.component.list(), 'type');
    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'componentData')){
        res.locals.component = req.session.componentData;
        delete req.session.componentData;
    }
    res.locals.title += ' - New Component';
    res.render('component/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try {
        const component = await req.models.component.get(id);
        res.locals.component = component;
        res.locals.component_types = await req.models.component_type.list();
        res.locals.components =  _.groupBy(await req.models.component.list(), 'type');
        if (_.has(req.session, 'componentData')){
            res.locals.furniture = req.session.componentData;
            delete req.session.componentData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/ritual', name: 'Ritual'},
                { url: '/component', name: 'Components'},
            ],
            current: 'Edit: ' + component.name
        };
        const path = await makeComponentPath([], component.parent_id, req);
        res.locals.breadcrumbs.path = res.locals.breadcrumbs.path.concat(path);
        res.locals.title += ` - Edit Component - ${component.name}`;

        res.render('component/edit');
    } catch (err){
        next(err);
    }
}

async function makeComponentPath(path, parent_id, req){
    if (parent_id){
        const parent = await req.models.component.get(parent_id);
        path.push({url:'/component/' + parent.id, name: capitalize(parent.type) + ': '+  parent.name});
        return await makeComponentPath(path, parent.parent_id, req);
    } else {
        return path.reverse();
    }
}

async function create(req, res, next){
    const component = req.body.component;

    req.session.componentData = component;
    if (!_.has(component, 'parent_id') && _.has(component, 'parent_id_type')){
        component.parent_id = component.parent_id_type;
    }

    try{
        const id = await req.models.component.create(component);
        delete req.session.componentData;
        req.flash('success', 'Created Component ' + component.name);
        res.redirect('/component/'+ id);
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/component/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const component = req.body.component;
    req.session.componentData = component;

    if (!_.has(component, 'parent_id') && _.has(component, 'parent_id_type')){
        component.parent_id = component.parent_id_type;
    }


    try {
        const current = await req.models.component.get(id);

        await req.models.component.update(id, component);
        delete req.session.componentData;
        req.flash('success', 'Updated Component ' + component.name);
        res.redirect('/component');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/component/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.component.delete(id);
        req.flash('success', 'Removed Component');
        res.redirect('/component');
    } catch(err) {
        return next(err);
    }
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const router = express.Router();

router.use(permission('contrib'));
router.use(function(req, res, next){
    res.locals.siteSection='gm';
    next();
});

router.get('/', list);
router.get('/new', csrf(), showNew);
router.get('/:id', csrf(), show);
router.get('/:id/edit', csrf(), showEdit);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.get('/:id/delete', remove);

module.exports = router;
