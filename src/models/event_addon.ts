'use strict';

import validator from 'validator';
import Model from  '../lib/Model';

const tableFields = [
    'id',
    'campaign_id',
    'event_id',
    'name',
    'cost',
    'available_to_player',
    'available_to_staff',
    'charge_player',
    'charge_staff',
    'on_checkin'
];

const EventAddon = new Model('event_addons', tableFields, {
    order: ['name'],
    validator: validate
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

export = EventAddon;
