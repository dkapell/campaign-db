'use strict';

import models from './models';

export default function(){
    return function(req, res, next){
        req.audit = async function audit(objectType:string, objectId:number, action:string, data:{ [k: string]: unknown }){
            return models.audit.create({
                campaign_id: req.campaign.id,
                user_id: req.user?req.user.id:-1,
                object_type: objectType,
                object_id: objectId,
                action: action,
                data: data
            });
        };
        next();
    };
};


