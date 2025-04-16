'use strict';
import Model from  '../lib/Model';

import documentationModel from './documentation';

const models = {
    documentation: documentationModel
};

const tableFields = [
    'id',
    'campaign_id',
    'documentation_id',
    'user_id',
    'notes',
    'valid_date'
];

const DocumentationUser = new Model('documentations_users', tableFields, {
    postSelect: fill
});

export = DocumentationUser;

async function fill(data){
    const documentation = await models.documentation.get(data.documentation_id);
    if (documentation.valid_from){
        data.valid_from = new Date(documentation.valid_from);
        data.name = documentation.name;
        if ((new Date(documentation.valid_from)).getTime() < (new Date(data.valid_date).getTime())){
            data.status = 'valid';
        } else {
            data.status = 'expired';
        }
    } else {
        data.status = 'valid'
    }
    return data;

}
