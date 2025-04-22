'use strict';
import Model from  '../lib/Model';

const tableFields = [
    'id',
    'order_id',
    'object_type',
    'object_id',
    'name',
    'cost_in_cents',
    'quantity',
    'created'
];

const OrderItem = new Model('orders_items', tableFields, {
    order: ['created']
});

export = OrderItem;

