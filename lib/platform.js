'use strict';

const JablotronService = require('./service');

class JablotronPlatform {

    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;

        this.api.on('didFinishLaunching', () => {
            try {
                this.start();
            } catch (error) {
                this.log.error('Failed to start Jablotron platform:', error);
            }
        });
    }

    getLog() {
        return this.log;
    }

    getAPI() {
        return this.api;
    }

    accessories(callback) {
        this.accessories = [];
        this.services = [];

        if (!this.config['services'] || !Array.isArray(this.config['services'])) {
            this.log.warn('No services configured for Jablotron plugin.');
            return callback([]);
        }

        for (let i = 0; i < this.config['services'].length; i++) {
            const serviceConfig = this.config['services'][i];
            const jablotronService = new JablotronService(this, serviceConfig);

            this.services.push(jablotronService);

            const accessories = jablotronService.createAccessories();
            for (let j = 0; j < accessories.length; j++) {
                this.accessories.push(accessories[j]);
            }
        }

        callback(this.accessories);
    }

    start() {
        this.log.info('Starting Jablotron platform...');

        if (!this.services || this.services.length === 0) {
            this.log.warn('No services initialized.');
            return;
        }

        for (let i = 0; i < this.services.length; i++) {
            const service = this.services[i];
            try {
                service.initialise();
            } catch (error) {
                this.log.error(`Failed to initialize service: ${error}`);
            }
        }
    }
}

module.exports = JablotronPlatform;