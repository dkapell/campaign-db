'use strict';

const models = require('./models');

module.exports = function(){
    return function(req, res, next){
        req.audit = async function audit(objectType, objectId, action, data){
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


