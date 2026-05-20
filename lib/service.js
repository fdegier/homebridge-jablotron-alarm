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

    hasPGMAccessory: function() {
        return this.pgmAccessory;
    },

    hasThermometerAccessory: function() {
        return this.thermometerAccessory;
    },

    findAccessory: function (key) {
        let result = []
        for (let i = 0; i < this.devices.length; i++) {
            let accessory = this.devices[i];
            if (accessory.matchesSegmentKey(key)) {
                result.push(accessory);
            }
        }
        return result;
    },

    createAccessories: function () {
        this.devices = [];
        this.pgmAccessory = false;
        this.thermometerAccessory = false;

        let sections = this.config['sections'] || {};
        for (let i = 0; i < sections.length; i++) {
            let accConfig = sections[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_SECTION));
        }

        sections = this.config['switches'] || {};
        for (let i = 0; i < sections.length; i++) {
            let accConfig = sections[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_SWITCH));
            this.pgmAccessory = true;
        }

        sections = this.config['outlets'] || {};
        for (let i = 0; i < sections.length; i++) {
            let accConfig = sections[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_OUTLET));
            this.pgmAccessory = true;
        }

        sections = this.config['thermometers'] || {};
        for (let i = 0; i < sections.length; i++) {
            let accConfig = sections[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_THERMOMETER));
            this.thermometerAccessory = true;
        }

        sections = this.config['contact_sensors'] || {};
        for (let i = 0; i < sections.length; i++) {
            let accConfig = sections[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_CONTACT_SENSOR));
            this.pgmAccessory = true;
        }

        return this.devices;
    },

    startRefresh: function () {
        this.debug("Refreshing status for Jablotron service " + this.getId());
        this.refreshingState = true;
        return this;
    },

    finishRefresh: function (timestamp) {
        this.debug("Status refreshed for Jablotron service " + this.getId());
        this.refreshingState = false;
        this.lastRefreshed = timestamp;
    },

    refreshState: function () {
        if (this.refreshingState) {
            this.debug("Jablotron service " + this.getId() + " is already refreshing its status => ignoring");
            return;
        }

        let currentTimestamp = moment().valueOf();
        if (currentTimestamp < this.lastRefreshed + this.serviceConfig.getPollInterval()) {
            this.debug("Jablotron service " + this.getId() + " status was last refreshed shortly before => ignoring");
            return;
        }
        
        let self = this.startRefresh();
        this.jablotron.getAccessoryStates(function (segmentId, segmentStatus, segmentInformations) {
            if (segmentId != null) {
                let accessories = self.findAccessory(segmentId);
                if (accessories.length === 0) {
                    self.log.warn("No accessory matches segment_id \"" + segmentId
                        + "\" — run config-helper.js and use the SEC-... cloud-component-id");
                } else {
                    for (let i = 0; i < accessories.length; i++) {
                        let accessory = accessories[i];
                        self.log("Accessory state for segment " + segmentId + " = " + segmentStatus);
                        accessory.mapAndUpdateState(segmentStatus, segmentInformations, null);
                    }
                }
            } else {
                self.finishRefresh(currentTimestamp);
            }
        });
    },

    updateAndRefreshOnStateChange: function (accessory, success, targetState, callback) {
        if (success) {
            accessory.updateState(targetState, false);
        } else if (accessory.getCachedState() != null) {
            accessory.updateState(accessory.getCachedState(), false);
        } else {
            this.log.warn("Arm/disarm failed for \"" + accessory.name
                + "\" (" + accessory.getSegmentId() + ") — check ERROR lines above (pincode, auth, open door?)");
        }

        if (callback) {
            if (success) {
                callback(null, targetState);
            } else {
                callback(new Error("Jablotron control failed for " + accessory.getSegmentId()));
            }
        }

        if (this.serviceConfig.isRefreshOnStateChange()) {
            this.lastRefreshed = 0;
            this.refreshState();
        }
    },

    getState: function (accessory, callback) {
        this.jablotron.getAccessoryState(accessory, callback);
    },

    setState: function (accessory, state, callback) {
        let self = this;
        let cachedState = accessory.getCachedState();

        if (accessory.isPGM()) {
            if (state === true) {
                this.jablotron.activateAcccessory(accessory, function (success) {
                    self.updateAndRefreshOnStateChange(accessory, success, state, callback);
                });
            } else {
                this.jablotron.deactivateAccessory(accessory, function (success) {
                    self.updateAndRefreshOnStateChange(accessory, success, state, callback);
                });
            }
        } else {
            if (state === accessory.getDisarmedMapping()) {
                this.jablotron.deactivateAccessory(accessory, function (success) {
                    self.updateAndRefreshOnStateChange(accessory, success, state, callback);
                });
            } else if (state === accessory.getPartiallyArmedMapping()) {
                this.jablotron.partiallyActivateAccessory(accessory, function (success) {
                    self.updateAndRefreshOnStateChange(accessory, success, state, callback);
                });
            } else if (state === accessory.getArmedMapping()) {
                this.jablotron.activateAcccessory(accessory, function (success) {
                    self.updateAndRefreshOnStateChange(accessory, success, state, callback);
                });
            } else {
                this.log.error("Unsupported state = " + state);
                if (callback) {
                    callback(new Error("Unsupported state = " + state));
                }
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
        this.log("Initialising Jablotron service " + this.getId());
        this.jablotron.getServices();

        let self = this;
        this.jablotron.resolveAccessoryComponentIds(this.devices, function () {
            if (self.serviceConfig.isAutoRefresh()) {
                self.refreshState();

                setInterval(function () {
                    self.refreshState();
                }, self.serviceConfig.getPollInterval());
            }
        });
    }
}

module.exports = JablotronService;