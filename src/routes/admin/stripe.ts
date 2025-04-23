import express from 'express';
import config from 'config';
import Stripe from 'stripe';
import permission from '../../lib/permission';
import orderHelper from '../../lib/orderHelper';

const stripe = new Stripe(config.get('stripe.secretKey'));


async function createStripeAccount(req, res) {
    try {
        if (req.campaign.stripe_account_id){
            return res.json({
                account: req.campaign.stripe_account_id,
            });
        }
        const account = await stripe.accounts.create({});

        await req.models.campaign.update(req.campaign.id, {stripe_account_id:account.id});
        res.json({
            account: account.id,
        });
    } catch (error) {
        console.error(
            "An error occurred when calling the Stripe API to create an account",
            error
        );
        res.status(500);
        res.send({ error: error.message });
    }
}

async function linkStripeAccount(req, res){
    try {
        if (!req.campaign.stripe_account_id){
            res.status(500);
            return res.send({ error: 'No account ID established yet' });
        }
        const account = req.campaign.stripe_account_id;

        const accountLink = await stripe.accountLinks.create({
            account: req.campaign.stripe_account_id,
            return_url: `${req.headers.origin}/admin/stripe/return/${account}`,
            refresh_url: `${req.headers.origin}/admin/stripe/refresh/${account}`,
            type: "account_onboarding",
        });

        res.json(accountLink);
    } catch (error) {
        console.error(
            "An error occurred when calling the Stripe API to create an account link:",
            error
        );
        res.status(500);
        res.send({ error: error.message });
    }
}

async function refreshStripeConnection(req, res){
    try {

        if (!req.campaign.stripe_account_id){
            return res.redirect(`/admin/campaign/${req.campaign.id}`);
        }
        const account = req.campaign.stripe_account_id;
        if (req.params.id!== account){
            throw new Error('Stripe ID Mismatch');
        }
        const accountLink = await stripe.accountLinks.create({
            account: req.campaign.stripe_account_id,
            return_url: `${req.headers.origin}/admin/stripe/return/${account}`,
            refresh_url: `${req.headers.origin}/admin/stripe/refresh/${account}`,
            type: "account_onboarding",
        });

        res.redirect(accountLink.url);
    } catch (error) {
        console.error(
            "An error occurred when calling the Stripe API to refresh an account link:",
            error
        );
        res.status(500);
        res.send({ error: error.message });
    }
}

async function returnStripeConnection(req, res){
    try {
        if (!req.campaign.stripe_account_id){
            return res.redirect(`/admin/campaign/${req.campaign.id}`);
        }

        if (req.params.id!== req.campaign.stripe_account_id){
            throw new Error('Stripe ID Mismatch');
        }

        const account = await stripe.accounts.retrieve(req.campaign.stripe_account_id);

        if (account.details_submitted){
            await req.models.campaign.update(req.campaign.id, {stripe_account_ready:true});
        } else {
            res.redirect(`/admin/stripe/refresh/${req.campaign.stripe_account_id}`);
        }

        res.redirect(`/admin/campaign/${req.campaign.id}`);
    } catch (error){
        console.trace(error);
        res.status(500);
        res.send({ error: error.message });
    }
}

async function handleStripeWebhook(req, res){
    const endpointSecret = config.get('stripe.endpointSecret');
    if (typeof endpointSecret !== 'string'){
        res.send();
    }
    let event = req.body;
    if (endpointSecret){
        const signature = req.headers['stripe-signature'];
        try {
          event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            endpointSecret as string
          );
        } catch (err) {
          console.log(`⚠️  Webhook signature verification failed.`, err.message);
          return res.sendStatus(400);
        }
    }
    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
            await fulfillCheckout(req, event.data.object.id);
            break;

        case 'checkout.session.async_payment_failed':
            await unfulfillCheckout(req, event.data.object.id);
            break;


    default:
        // Unexpected event type
        console.log(`Unhandled event type ${event.type}.`);
  }

  res.send();
}

async function stripeSuccess(req, res){
    try {

        const session = await fulfillCheckout(req, req.query.session_id);
        req.flash('success', 'Payment processed, thank you!');
        if (session.metadata && session.metadata.return){
            return res.redirect(session.metadata.return);
        } else {
            return res.redirect('/');
        }
    } catch(err){
        console.trace(err);
        req.flash('error', err.message);
        return res.redirect('/');
    }
}

async function fulfillCheckout(req, checkoutId){
    const session = await stripe.checkout.sessions.retrieve(checkoutId, {stripeAccount:req.campaign.stripe_account_id});
    if (!(session.metadata && session.metadata.orderId)){
        throw new Error('No order id found');
    }
    const order = await req.models.order.get(session.metadata.orderId);
    if (!order){
        throw new Error('No order found');
    }
    if (session.payment_status !== 'paid'){
        req.flash('error', 'Something went wrong with payment');

    }
    if (order.status !== 'complete'){
        order.status = 'complete';
        order.updated = new Date();
        order.paid = new Date();

        const intent = await stripe.paymentIntents.retrieve(session.payment_intent as string, {stripeAccount:req.campaign.stripe_account_id});
        order.charge_id = intent.latest_charge;
        await orderHelper.payOrder(order.id);
        await req.models.order.update(order.id, order);

    }
    return session;
}

async function unfulfillCheckout(req, checkoutId){
    const session = await stripe.checkout.sessions.retrieve(checkoutId, {stripeAccount:req.campaign.stripe_account_id});
    if (!(session.metadata && session.metadata.orderId)){
        throw new Error('No order id found');
    }
    const order = await req.models.order.get(session.metadata.orderId);
    if (!order){
        throw new Error('No order found');
    }

    if (order.status !== 'complete'){
        order.status = 'failed';
        order.updated = new Date();
        await req.models.order.update(order.id, order);
    }
    return session;
}

const router = express.Router();

router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.post('/hook', express.raw({type: 'application/json'}), handleStripeWebhook);
router.post('/account', permission('admin'), createStripeAccount);
router.post('/account_link', permission('admin'), linkStripeAccount);
router.get('/refresh/:id', permission('admin'), refreshStripeConnection);
router.get('/return/:id', permission('admin'), returnStripeConnection);
router.get('/success', stripeSuccess);

export default router;
