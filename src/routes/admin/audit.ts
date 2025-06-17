import express from 'express';
import _ from 'underscore';
import moment from 'moment';
import permission from '../../lib/permission';
import async from 'async';
import skillHelper from '../../lib/skillHelper';
import models from '../../lib/models';

/* GET audits listing. */
async function list(req, res){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Audits'
    };
    res.render('admin/audit/list', { pageTitle: 'Audits' });
}

async function listSkillAudits(req, res){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/skil', name: 'Skills'},

        ],
        current: 'Audits'
    };
    res.render('admin/audit/listSkills', { pageTitle: 'Skill Changes' });
}

async function query(req, res){
    const options:RequestOptions = {};
    if (_.has(req.query, 'start')){
        options.offset = req.query.start;
    }
    if (_.has(req.query, 'length')){
        options.limit = req.query.length;
    }
    if (_.has(req.query, 'order')){
        options.order = [];

        for (const order of req.query.order){
            let orderStr = '';
            switch (Number(order.column)){
                case 0: orderStr = 'created'; break;
                case 1: orderStr = 'user_id'; break;
                case 2: orderStr = 'action'; break;
                case 3: orderStr = 'object_type'; break;
                default: orderStr = 'created'; break;
            }
            orderStr += ` ${order.dir}`;
            options.order.push(orderStr);
        }
    }
    const response = {
        draw: Number(req.query.draw),
        recordsFiltered:0,
        recordsTotal:0,
        data:[],
        error:null
    };

    try {
        let audits = [];
        /*
        if (req.query.search && req.query.search.value){
            audits = await req.models.audit.search(req.query.search.value, options);
            response.recordsFiltered = await req.models.audit.searchCount(req.query.search.value);
        } else {
        */
        audits = await req.models.audit.find({campaign_id:req.campaign.id}, options);
        response.recordsFiltered = await req.models.audit.count();
        // }
        response.data = await async.map(audits, async (audit) => {
            audit.createdFormated = moment(audit.created).format('lll');
            if (audit.object_type === 'skill'){
                audit.diff = await skillHelper.diff(audit.data.old, audit.data.new);
            } else if (audit.data) {
                audit.diff = await objectDiff(audit.object_type, audit.data.old, audit.data.new);
            }
            if (audit.object_type === 'attendance' && audit.object){
                audit.object.name = audit.object.user.name;
                audit.object.url = `/event/${audit.object.event_id}/register/${audit.object_id}`;
            }
            return audit;
        });
        response.recordsTotal = await req.models.audit.count();

        res.json(response);
    } catch (err) {
        response.error = err.toString();
        console.log(err);
        res.json(response);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const audit = await req.models.audit.get(id);
        if (!audit || audit.campaign_id !== req.campaign.id){
            throw new Error('Invalid Audit');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/audit', name: 'Audits'},
            ],
            current: 'Audit'
        };
        res.render('admin/audit/show');
    } catch(err){
        next(err);
    }
}

async function objectDiff(type, oldObject, newObject){
    if (!_.has(models, type)){
        return [];
    }
    const fields = models[type].fields;
    const skipFields = models[type].options.skipAuditFields;
    const changes = [];
    if (!oldObject){
        changes.push({
            field: capitalize(type),
            type: 'status',
            status: 'Created'
        });
        return changes;
    }
    if (!newObject){
        changes.push({
            field: capitalize(type),
            type: 'status',
            status: 'Deleted'
        });
        return changes;
    }
    for (const field of fields){
        if (field === 'campaign_id'){
            continue;
        }
        if (_.indexOf(skipFields, field) !== -1){
            continue;
        }

        if (newObject[field] != oldObject[field]){
            const oldVal = oldObject[field];
            const newVal = newObject[field];
            if (typeof oldVal === 'object' || typeof newVal === 'object'){
                changes.push({
                    field: capitalize(field),
                    type: 'status',
                    status: 'Changed'
                });
                continue;
            }
            if (oldVal === true && newVal === 'on'){
                continue;
            }
            if (_.isNull(oldVal) && newVal === ''){
                continue;
            }

            changes.push({
                field: capitalize(field),
                type: 'field',
                old: oldObject[field],
                new: newObject[field]
            });
        }
    }
    return changes;

}

function capitalize(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const router = express.Router();

router.use(permission('gm'));
router.use(function(req, res, next){
    res.locals.siteSection='admin';
    res.locals.title += ' - Audits';
    next();
});

router.get('/', list);
router.get('/skill', listSkillAudits);
router.get('/query', query);
router.get('/:id', show);


export default router;
