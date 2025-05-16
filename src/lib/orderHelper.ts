import config from 'config';
import Stripe from 'stripe';
import moment from 'moment';
import async from 'async';
import stringify from 'csv-stringify-as-promised';
import models from './models';


const stripe = new Stripe(config.get('stripe.secretKey'));

async function addItemsToOrder(campaignId:number, userId:number, items:OrderItem[]): Promise<ModelData>{
    const order = await getOpenOrder(campaignId, userId, true);
    for (const item of items){
        const object = await models[item.type].get(item.id);
        if (!object){
            continue;
        }
        const order_item = await models.order_item.findOne({order_id:order.id, object_type:item.type, object_id:object.id});
        if (order_item){
            if (object.paid){
                // remove already paid for items.
                await models.order_item.delete(order_item.id);
            }
        } else {
            await models.order_item.create({
                order_id:order.id,
                object_type: item.type,
                object_id: object.id,
                name: item.name||='Unknown Item',
                cost_in_cents: item.cost,
                quantity: item.quantity?item.quantity:1,
                created: new Date()
            })
        }
    }
    return models.order.get(order.id);
}

async function checkout(orderId:number, returnUrl:string):Promise<Stripe.Checkout.Session>{
    const order = await models.order.get(orderId);
    if (!order) {
        throw new Error('Invalid Order');
    }
    const campaign = await models.campaign.get(order.campaign_id);
    if (!campaign.stripe_account_ready){
        throw new Error ('Campaign is not configured for Stripe');
    }
    if (!order.status.match(/^(new|checkout)$/)){
        throw new Error('Order already submitted');
    }
    if (order.checkout_id) {
        const checkoutSession = await stripe.checkout.sessions.retrieve(order.checkout_id, {stripeAccount:campaign.stripe_account_id});
        if (checkoutSession.status !== 'expired'){
            // Expire old session and start over
            await stripe.checkout.sessions.expire(order.checkout_id, {stripeAccount:campaign.stripe_account_id});
        }
    }

    const user = await models.user.get(campaign.id, order.user_id);
    let return_url = `${config.get('app.secureOnly')?'https':'http'}://`
    return_url += `${campaign.site}/admin/stripe/success`;
    return_url += '?session_id={CHECKOUT_SESSION_ID}';
    const doc :Stripe.Checkout.SessionCreateParams= {
        line_items: [],
        metadata:{
            orderId:orderId,
            return:returnUrl,
            campaignId: campaign.id
        },
        payment_intent_data: {
            application_fee_amount: 0,
        },
        mode: 'payment',
        ui_mode: 'embedded',
        customer_email: user.email,
        return_url: return_url
    }
    order.payment_amount_cents = 0;
    for (const item of order.order_items){
        doc.line_items.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.name,
                },
                unit_amount: item.cost_in_cents,

            },
            quantity: item.quantity,
        });
        order.payment_amount_cents += item.cost_in_cents;
    }
    order.status = 'checkout';
    order.submitted = new Date();
    order.updated = new Date();
    const session = await stripe.checkout.sessions.create(doc, {stripeAccount:campaign.stripe_account_id});
    order.checkout_id = session.id;
    await models.order.update(order.id, order);
    return session;
}

async function getOpenOrder(campaignId:number, userId:number, create:boolean=false): Promise<OrderModel>{
    let order = await models.order.findOne({campaign_id:campaignId, user_id: userId, status:'new'});
    if (order){
        return order;
    }
    order = await models.order.findOne({campaign_id:campaignId, user_id: userId, status:'checkout'});
    if (order){
        return order;
    }
    if (!create){
       return null;
    }
    const orderId = await models.order.create({
        campaign_id:campaignId,
        user_id:userId,
        status:'new',
        created: new Date(),
        updated: new Date()
    });
    return models.order.get(orderId);
}

async function payOrder(orderId:number): Promise<void>{
    const order = await models.order.get(orderId);
    if (!order) {
        throw new Error('Order not found');
    }
    for (const item of order.order_items){
        const object = await models[item.object_type].get(item.object_id);
        if (!object){
            console.log(`Could not find ${item.object_type}:${item.object_id}`);
            continue;
        }
        object.paid = true;
        await models[item.object_type].update(object.id, object);
    }
}

async function unpayOrder(orderId:number): Promise<void>{
    const order = await models.order.get(orderId);
    if (!order) {
        throw new Error('Order not found');
    }
    for (const item of order.order_items){
        const object = await models[item.object_type].get(item.object_id);
        if (!object){
            console.log(`Could not find ${item.object_type}:${item.object_id}`);
            continue;
        }
        object.paid = false;
        await models[item.object_type].update(object.id, object);
    }
}

interface refundOptions {
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

async function refund(orderId:number, options:refundOptions = {}): Promise<Stripe.Refund>{
    const order = await models.order.get(orderId);
    if (!order) {
        throw new Error('Order not found');
    }
    if (!order.charge_id.match(/^ch_/)){
        throw new Error('Invalid Charge Id');
    }
    const campaign = await models.campaign.get(order.campaign_id);
    const doc: Stripe.RefundCreateParams = {
        charge: order.charge_id,
        metadata: {
            campaignId: campaign.id,
            orderId: order.id
        },
        reason: options.reason||= 'requested_by_customer'
    };

    return stripe.refunds.create(doc, { stripeAccount:campaign.stripe_account_id });
}

async function isPaid(objectType:string, objectId:number): Promise<boolean|number>{
    const object = await models[objectType].get(objectId);
    if (!object){
        throw new Error('Invalid Object');
    }
    if (!object.paid){
        return false;
    }
    const order_items = await models.order_item.find({object_type:objectType, object_id:objectId});

    for (const order_item of order_items){
        const order = await models.order.get(order_item.order_id);
        if (order.status === 'complete') { return order.id; }
    }
    return false;
}

function isSubmitted(order){
    if (order.status === 'new') { return false; }
    if (order.status === 'checkout') { return false; }
    return true;
}

async function buildCsv(orders:OrderModel[], showUser?:boolean): Promise<string>{
    const output = [];
    const header = ['Order ID']
    if (showUser){
        header.push('Stripe Id');
        header.push('User');
        header.push('Email');
    }
    for (const item of ['Status', 'Amount', 'Created', 'Updated', 'Submitted', 'Paid', 'Items']){
        header.push(item);
    }
    output.push(header);
    for (const order of orders){
        const row = [];
        row.push(order.id);
        if (showUser){
            row.push(order.charge_id);
            if (order.user){
                row.push(order.user.name);
                row.push(order.user.email);
            } else {
                const user = await models.user.get(order.campaign_id, order.user_id);
                row.push(user.name);
                row.push(user.email);
            }
        }
        row.push(order.status);
        row.push(order.payment_amount_cents/100);
        const campaign = await models.campaign.get(order.campaign_id);
        for (const field of ['created', 'updated', 'submitted', 'paid']){
            if (!order[field]){
                row.push(null);
            } else {
                const timestamp = moment.utc(order[field]).tz(campaign.timezone);
                row.push(timestamp.format('lll'));
            }
        }
        const items = [];
        for (const item of order.order_items){
            items.push(`${item.name} ($${item.cost_in_cents/100}${item.quantity!==1?'x'+item.quantity:''})`);
        }
        row.push(items.join(', '));
        output.push(row);
    }
    return stringify(output, {});
}

async function emptyOrder(campaignId:number, userId:number, create?:boolean): Promise<void>{
    const order = await getOpenOrder(campaignId, userId, create);
    if (!order){ return; }
    await async.each(order.order_items, async (order_item) => {
        return models.order_item.delete(order_item.id);
    })
    order.payment_amount_cents = null;
    order.updated = new Date();
    order.status = 'new';
    await models.order.update(order.id, order);
    return;
}

export default {
    checkout,
    getOpenOrder,
    addItemsToOrder,
    emptyOrder,
    payOrder,
    unpayOrder,
    refund,
    isPaid,
    isSubmitted,
    buildCsv
};
