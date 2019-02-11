'use strict';

const JablotronConstants = require('./const');

function JablotronServiceConfig(config) {
    this.id = config['id'];
    this.name = config['name'];
    this.username = config['username'];
    this.password = config['password'];
    this.pincode = config['pincode'];
    this.autoRefresh = this.configValue(config, 'autoRefresh', JablotronConstants.DEFAULT_AUTO_REFRESH);
    this.pollInterval = this.configValue(config, 'pollInterval', JablotronConstants.DEFAULT_POLL_INTERVAL);
    this.refreshOnStateChange = this.configValue(config, 'refreshOnStateChange', JablotronConstants.DEFAULT_REFRESH_ON_STATE_CHANGE);
    this.debug = this.configValue(config, 'debug', JablotronConstants.DEFAULT_DEBUG);
}

JablotronServiceConfig.prototype = {

    configValue: function (config, key, defaultValue) {
        var value = config[key];
        if (value != undefined) {
            return value;
        }

        return defaultValue;
    },

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
