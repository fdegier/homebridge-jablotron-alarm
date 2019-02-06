'use strict';

const JablotronConstants = require('./const');

function JablotronServiceConfig(config) {
    this.id = config['id'];
    this.name = config['name'];
    this.username = config['username'];
    this.password = config['password'];
    this.pincode = config['pincode'];
    this.pollInterval = config['pollInterval'] || JablotronConstants.DEFAULT_POLL_INTERVAL;
    this.refreshOnStateChange = config['refreshOnStateChange'] || true;
    this.debug = config['debug'] || false;
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

    isDebug: function () {
        return this.debug;
    },

    getPollInterval: function () {
        return this.pollInterval * 1000;
    },

    isRefreshOnStateChange: function () {
        return this.refreshOnStateChange;
    }
}

module.exports = JablotronServiceConfig;
