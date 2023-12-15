'use strict';
var fs = require('fs');
var _ = require('underscore');
var path = require('path');
var database = require('./database');

var models = {database: database};

var modelDir = '../models';

loadModels(__dirname + '/' + modelDir);

module.exports = models;

function loadModels(dir){
    _.each(fs.readdirSync(dir), function(filename){
        if (filename.match(/\.js$/)){
            var modelName = path.basename(filename, '.js');
            models[modelName] = require(dir + '/' + filename);
        }
    });
}
