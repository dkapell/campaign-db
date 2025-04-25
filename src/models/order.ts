'use strict';
import Model from  '../lib/Model';

import order_itemModel from './order_item';

const models = {
    order_item: order_itemModel
};

const tableFields = [
    'id',
    'campaign_id',
    'user_id',
    'status',
    'checkout_id',
    'charge_id',
    'payment_amount_cents',
    'payment_note',
    'created',
    'updated',
    'submitted',
    'paid'
];

const Order = new Model('orders', tableFields, {
    order: ['updated desc'],
    postSelect: fill,
});

export = Order;

async function fill(data){
    data.order_items = await models.order_item.find({order_id: data.id});
    return data;
}


