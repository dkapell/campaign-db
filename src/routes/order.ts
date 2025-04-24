import express from 'express';
import csrf from 'csurf';
import async from 'async';
import permission from '../lib/permission';
import orderHelper from '../lib/orderHelper';


/* GET uploads listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'My Orders'
    };
    try {
        let orders = await req.models.order.find({campaign_id:req.campaign.id, user_id:req.session.activeUser.id});
        orders = orders.filter(orderHelper.isSubmitted);
        if (req.query.export){
            const csvOutput = await orderHelper.buildCsv(orders, false);
            res.attachment(`${req.campaign.name} - My Orders.csv`);
            return res.end(csvOutput);
        } else {
            res.locals.orders = orders;
        }
        res.locals.title += ' - My Orders';
        res.render('order/list', { pageTitle: 'My Orders' });
    } catch (err){
        next(err);
    }
}

async function listAll(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'All Orders'
    };
    try {
        res.locals.siteSection='admin';
        let orders = await req.models.order.find({campaign_id:req.campaign.id});
        orders = await async.map(orders, async (order) => {
            order.user = await req.models.user.get(req.campaign.id, order.user_id);
            return order;
        });
        orders = orders.filter(orderHelper.isSubmitted);

        if (req.query.export){
            const csvOutput = await orderHelper.buildCsv(orders, true);
            res.attachment(`${req.campaign.name} - All Orders.csv`);
            return res.end(csvOutput);
        } else {
            res.locals.orders = orders;
        }

        res.locals.title += ' - All Orders';
        res.render('order/list_all', { pageTitle: 'All Orders' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try {
        const order = await req.models.order.get(id);
        if (!order || order.campaign_id!== req.campaign.id){
            throw new Error ('Invalid Order');
        }
        if (! req.checkPermission('gm') && req.session.activeUser.id !== order.user_id){
            req.flash('error', 'You are not allowed to view that order');
            return res.redirect('/order');
        }
        order.user = await req.models.user.get(req.campaign.id, order.user_id);
        res.locals.order = order;
        if (req.query.backto === 'all'){
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/order/all', name: 'All Orders'}
                ],
                current: `Order #${order.id}`
            };
        } else {
            res.locals.breadcrumbs = {
                path: [
                    { url: '/', name: 'Home'},
                    { url: '/order', name: 'My Orders'}
                ],
                current: `Order #${order.id}`
            };
        }
        res.locals.title += ` - Order #${order.id}`;
        res.locals.csrfToken = req.csrfToken();
        res.render('order/show');

    } catch (err){
        next(err);
    }
}
async function deleteOrder(req, res){
    const id = req.params.id;
    try{
       const order = await req.models.order.get(id);
        if (!order || order.campaign_id!== req.campaign.id){
            throw new Error ('Invalid Order');
        }
        if (req.body.refund){
            order.status = 'refunded';
            await orderHelper.refund(order.id);
        } else {
            order.status = 'deleted';
        }
        order.updated = new Date();
        await orderHelper.unpayOrder(order.id);
        await req.models.order.update(order.id, order);
        return res.json({success:true, refunded:req.body.refund});
    } catch (err){
        console.trace(err);
        return res.status(500).json({success:false, error:err.message});
    }
}
async function checkout(req, res){
    try {
        const order = await orderHelper.getOpenOrder(req.campaign.id, req.session.activeUser.id);
        if (!order){
            req.flash('info', 'No open order');
            return res.redirect('/');
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/order', name: 'My Orders'}
            ],
            current: `Checkout #${order.id}`
        };
        res.locals.order = order;
        res.locals.back = req.query.back;
        res.render('order/checkout');

    } catch(err) {
        console.trace(err);
        req.flash('error', err.message);
        res.redirect('/');
    }
}

async function createCheckoutSession(req, res){
    try {
        const order = await orderHelper.getOpenOrder(req.campaign.id, req.session.activeUser.id);
        if (!order){
            throw new Error('No open order')
        }
        const session = await orderHelper.checkout(order.id, req.body.back)
        res.json({clientSecret:session.client_secret});
    } catch(err) {
        console.trace(err);
        req.flash('error', err.message);
        res.redirect('/');
    }
}

const router = express.Router();

router.use(permission('login'));
router.use(function(req, res, next){
    res.locals.siteSection='user';
    if (!req.campaign.stripe_account_ready){
        req.flash('info', 'Orders are not enabled for this Campaign');
        return res.redirect('/');
    }
    next();
});

router.get('/', list);
router.get('/all', permission('gm'), listAll);
router.get('/checkout', checkout);
router.get('/:id', csrf(), show);
router.post('/create-checkout-session', createCheckoutSession);
router.delete('/:id', csrf(), permission('admin'), deleteOrder);


export default router;
