// noinspection JSUnresolvedFunction,NpmUsedModulesInstalled,JSUnresolvedVariable

'use strict';

const JablotronServiceConfig = require('./service-config');
const JablotronAccessory = require('./accessory');
const JablotronConstants = require('./const');
const Jablotron = require('./jablotron');
const moment = require('moment');

function JablotronService(platform, config) {
    this.platform = platform;
    this.log = platform.getLog();
    this.config = config;
    this.refreshingState = false;
    this.lastRefreshed = 0;

    this.serviceConfig = new JablotronServiceConfig(config);
    this.jablotron = new Jablotron(this);

    this.pgmAccessory = false;
    this.thermometerAccessory = false;
}

JablotronService.prototype = {

    getLog: function () {
        return this.log;
    },

    getPlatform: function () {
        return this.platform;
    },

    getId: function () {
        return this.serviceConfig.getId();
    },

    getServiceConfig: function () {
        return this.serviceConfig;
    },

    hasPGMAccessory: function () {
        return this.pgmAccessory;
    },

    hasThermometerAccessory: function () {
        return this.thermometerAccessory;
    },

    findAccessory: function (key) {
        const result = [];
        for (let i = 0; i < this.devices.length; i++) {
            const accessory = this.devices[i];
            if (key === accessory.getSegmentId()) {
                result.push(accessory);
            }
        }
        return result;
    },

    createAccessories: function () {
        this.devices = [];
        this.pgmAccessory = false;
        this.thermometerAccessory = false;

        // Sections
        const sections = this.config['sections'] || [];
        for (let i = 0; i < sections.length; i++) {
            const accConfig = sections[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_SECTION));
        }

        // Switches
        const switches = this.config['switches'] || [];
        for (let i = 0; i < switches.length; i++) {
            const accConfig = switches[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_SWITCH));
            this.pgmAccessory = true;
        }

        // Outlets
        const outlets = this.config['outlets'] || [];
        for (let i = 0; i < outlets.length; i++) {
            const accConfig = outlets[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_OUTLET));
            this.pgmAccessory = true;
        }

        // Thermometers
        const thermometers = this.config['thermometers'] || [];
        for (let i = 0; i < thermometers.length; i++) {
            const accConfig = thermometers[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_THERMOMETER));
            this.thermometerAccessory = true;
        }

        // Contact Sensors
        const contactSensors = this.config['contact_sensors'] || [];
        for (let i = 0; i < contactSensors.length; i++) {
            const accConfig = contactSensors[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_CONTACT_SENSOR));
            this.pgmAccessory = true;
        }

        return this.devices;
    },

    startRefresh: function () {
        this.debug(`Refreshing status for Jablotron service ${this.getId()}`);
        this.refreshingState = true;
        return this;
    },

    finishRefresh: function (timestamp) {
        this.debug(`Status refreshed for Jablotron service ${this.getId()}`);
        this.refreshingState = false;
        this.lastRefreshed = timestamp;
    },

    refreshState: function () {
        if (this.refreshingState) {
            this.debug(`Jablotron service ${this.getId()} is already refreshing its status => ignoring`);
            return;
        }

        const currentTimestamp = moment().valueOf();
        if (currentTimestamp < this.lastRefreshed + this.serviceConfig.getPollInterval()) {
            this.debug(`Jablotron service ${this.getId()} status was last refreshed shortly before => ignoring`);
            return;
        }

        const self = this.startRefresh();

        this.jablotron.getAccessoryStates(function (segmentId, segmentStatus, segmentInformations) {
            if (segmentId != null) {
                const accessories = self.findAccessory(segmentId);
                for (let i = 0; i < accessories.length; i++) {
                    const accessory = accessories[i];
                    if (accessory.isPGM) {
                        self.debug(`Accessory state for segment ${segmentId} = ${segmentStatus}`);
                        accessory.mapAndUpdateState(segmentStatus, segmentInformations, null);
                    }
                }
            } else {
                self.finishRefresh(currentTimestamp);
            }
        });
    },

    updateAndRefreshOnStateChange: function (accessory, state, callback) {
        accessory.updateState(state, false);
        callback(null, state);

        if (this.serviceConfig.isRefreshOnStateChange()) {
            this.lastRefreshed = 0;
            this.refreshState();
        }
    },

    getState: function (accessory, callback) {
        this.jablotron.getAccessoryState(accessory, callback);
    },

    setState: function (accessory, state, callback) {
        const self = this;
        const cachedState = accessory.getCachedState();

        if (accessory.isPGM()) {
            if (state === true) {
                this.jablotron.activateAcccessory(accessory, function (success) {
                    self.updateAndRefreshOnStateChange(accessory, success ? state : cachedState, callback);
                });
            } else {
                this.jablotron.deactivateAccessory(accessory, function (success) {
                    self.updateAndRefreshOnStateChange(accessory, success ? state : cachedState, callback);
                });
            }
        } else {
            if (state === accessory.getDisarmedMapping()) {
                this.jablotron.deactivateAccessory(accessory, function (success) {
                    self.updateAndRefreshOnStateChange(accessory, success ? state : cachedState, callback);
                });
            } else if (state === accessory.getPartiallyArmedMapping()) {
                this.jablotron.partiallyActivateAccessory(accessory, function (success) {
                    self.updateAndRefreshOnStateChange(accessory, success ? state : cachedState, callback);
                });
            } else if (state === accessory.getArmedMapping()) {
                this.jablotron.activateAcccessory(accessory, function (success) {
                    self.updateAndRefreshOnStateChange(accessory, success ? state : cachedState, callback);
                });
            } else {
                this.log.error(`Unsupported state = ${state}`);
            }
        }
    },

    debug: function (msg) {
        if (this.serviceConfig.isDebug()) {
            this.log(msg);
        }
    },

    debugPayload: function (msg) {
        if (this.serviceConfig.isDebugPayload()) {
            this.log(msg);
        }
    },

    initialise: function () {
        this.log.info(`Initialising Jablotron service ${this.getId()}`);
        this.jablotron.getServices();

        if (this.serviceConfig.isAutoRefresh()) {
            this.refreshState();

            const self = this;
            setInterval(() => {
                self.refreshState();
            }, this.serviceConfig.getPollInterval());
        }
    }
};

module.exports = JablotronService;