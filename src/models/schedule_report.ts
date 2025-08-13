'use strict';

import validator from 'validator';
import Model from  '../lib/Model';

const tableFields = [
    'id',
    'campaign_id',
    'name',
    'config'
];

const ScheduleReport = new Model('schedule_reports', tableFields, {
    order: ['name'],
    validator: validate,
});

function validate(data){
    if (! validator.isLength(data.name, {min:2, max:512})){
        return false;
    }
    return true;
}

export = ScheduleReport;
