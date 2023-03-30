// noinspection JSUnresolvedReference

'use strict';

const JablotronService = require('./service');

function JablotronPlatform(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;

    let self = this;
    this.api.on('didFinishLaunching', function () {
        self.start();
    });
}

JablotronPlatform.prototype = {

    getLog: function () {
        return this.log;
    },

    getAPI: function () {
        return this.api;
    },

    accessories: function (callback) {
        this.accessories = [];
        this.services = [];

        for (let i = 0; i < this.config['services'].length; i++) {
            let serviceConfig = this.config['services'][i];
            let jablotronService = new JablotronService(this, serviceConfig);

            this.services.push(jablotronService);

            let accessories = jablotronService.createAccessories();
            for (let j = 0; j < accessories.length; j++) {
                this.accessories.push(accessories[j]);
            }
        }

        callback(this.accessories);
    },

    start: function () {
        this.log("Starting Jablotron platform...");

        for (let i = 0; i < this.services.length; i++) {
            let service = this.services[i];
            service.initialise();
        }
    }
}

module.exports = JablotronPlatform;