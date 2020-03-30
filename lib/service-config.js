'use strict';

const JablotronConstants = require('./const');

function JablotronServiceConfig(config) {
    this.id = config['id'];
    this.name = config['name'];
    this.username = config['username'];
    this.password = config['password'];
    this.pincode = config['pincode'];
    if (config['service_type'] == undefined) {
        this.service_type = "ja100";
    } else {
        this.service_type = config['service_type'];
    }
    this.autoRefresh = JablotronConstants.readConfigValue(config, 'autoRefresh', JablotronConstants.DEFAULT_AUTO_REFRESH);
    this.pollInterval = JablotronConstants.readConfigValue(config, 'pollInterval', JablotronConstants.DEFAULT_POLL_INTERVAL);
    this.refreshOnStateChange = JablotronConstants.readConfigValue(config, 'refreshOnStateChange', JablotronConstants.DEFAULT_REFRESH_ON_STATE_CHANGE);
    this.debug = JablotronConstants.readConfigValue(config, 'debug', JablotronConstants.DEFAULT_DEBUG);
}

JablotronServiceConfig.prototype = {

    getId: function () {
        return this.id;
    },

    getName: function () {
        return this.name;
    },

    getUsername: function () {
        return this.username;
    },

    getPassword: function () {
        return this.password;
    },

    getPincode: function () {
        return this.pincode;
    },

    getServiceType: function() {
        return this.service_type
    },

    isDebug: function () {
        return this.debug;
    },

    isAutoRefresh: function () {
        return this.autoRefresh;
    },

    getPollInterval: function () {
        return this.pollInterval * 1000;
    },

    isRefreshOnStateChange: function () {
        return this.refreshOnStateChange;
    }
}

module.exports = JablotronServiceConfig;
