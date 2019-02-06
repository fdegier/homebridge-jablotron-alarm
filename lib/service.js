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

    findAccessory: function (key) {
        for (var i = 0; i < this.devices.length; i++) {
            var accessory = this.devices[i];
            if (key == accessory.getSegmentKey()) {
                return accessory;
            }
        }

        return null;
    },

    createAccessories: function () {
        this.devices = [];

        var sections = this.config['sections'] || {};
        for (var i = 0; i < sections.length; i++) {
            var accConfig = sections[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_SECTION));
        }

        sections = this.config['switches'] || {};
        for (var i = 0; i < sections.length; i++) {
            var accConfig = sections[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_SWITCH));
        }

        sections = this.config['outlets'] || {};
        for (var i = 0; i < sections.length; i++) {
            var accConfig = sections[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_OUTLET));
        }

        return this.devices;
    },

    refreshState: function () {
        if (this.refreshingState) {
            this.debug("Jablotron service " + this.getId() + " is already refreshing its status => ignoring");
            return;
        }

        var currentTimestamp = moment().valueOf();
        if (currentTimestamp < this.lastRefreshed + this.serviceConfig.getPollInterval()) {
            this.debug("Jablotron service " + this.getId() + " status was last refreshed shortly before => ignoring");
            return;
        }

        this.debug("Refreshing status for Jablotron service " + this.getId());

        this.refreshingState = true;
        var self = this;

        this.jablotron.getAccessoryStates(function(segmentKey, segmentStatus) {
            self.debug("Accessory state for segment " + segmentKey + " = " + segmentStatus);

            var accessory = self.findAccessory(segmentKey);
            if (accessory != null) {
                accessory.mapAndUpdateState(segmentStatus);
            }
        });

        this.refreshingState = false;
        this.lastRefreshed = currentTimestamp;
    },

    updateAndRefreshOnStateChange: function (accessory, state, callback) {
        accessory.updateState(state);
        callback(null, state);

        if (this.serviceConfig.isRefreshOnStateChange()) {
            this.lastRefreshed = 0;
            this.refreshState();
        }
    },

    setState: function(accessory, state, callback) {
        var self = this;

        if (accessory.isPGM()) {
            if (state == true) {
                this.jablotron.activateAcccessory(accessory, function(didStateChanged) {
                    if (didStateChanged) {
                        self.updateAndRefreshOnStateChange(accessory, state, callback);
                    }
                })
            } else {
                this.jablotron.deactivateAccessory(accessory, function(didStateChanged) {
                    if (didStateChanged) {
                        self.updateAndRefreshOnStateChange(accessory, state, callback);
                    }
                })
            }
        } else {
            if (state == "3") {
                this.jablotron.deactivateAccessory(accessory, function(didStateChanged) {
                    if (didStateChanged) {
                        self.updateAndRefreshOnStateChange(accessory, state, callback);
                    }
                })
            } else if (state == "2" || state == "0") {
                this.jablotron.partiallyActivateAccessory(accessory, function(didStateChanged) {
                    if (didStateChanged) {
                        self.updateAndRefreshOnStateChange(accessory, state, callback);
                    }
                })
            } else {
                this.jablotron.activateAcccessory(accessory, function(didStateChanged) {
                    if (didStateChanged) {
                        self.updateAndRefreshOnStateChange(accessory, state, callback);
                    }
                })
            }
        }
    },

    debug: function(msg) {
        if (this.serviceConfig.isDebug()) {
            this.log(msg);
        }
    },

    initialise: function () {
        this.log("Initialising Jablotron service " + this.getId());
        this.refreshState();

        var self = this;
        setInterval(function () {
            self.refreshState();
        }, this.serviceConfig.getPollInterval());
    }
}

module.exports = JablotronService;