'use strict';

const JablotronService = require('./service');

function JablotronPlatform(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
}

JablotronPlatform.prototype = {

    getLog: function() {
        return this.log;
    },

    getAPI: function() {
        return this.api;
    },

    accessories: function (callback) {
        this.accessories = [];
        this.services = [];

        for (var i = 0; i < this.config['services'].length; i++) {
            var serviceConfig = this.config['services'][i];
            var jablotronService = new JablotronService(this, serviceConfig);

            this.services.push(jablotronService);

            var accessories = jablotronService.createAccessories();
            for (var j = 0; j < accessories.length; j++) {
                this.accessories.push(accessories[j]);
            }
        }

        callback(this.accessories);
        this.start();
    },

    start: function() {
        this.log("Starting Jablotron platform...");

        for (var i = 0; i < this.services.length; i++) {
            var service = this.services[i];
            service.initialise();
        }
    }
}

module.exports = JablotronPlatform;