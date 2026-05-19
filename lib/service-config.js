'use strict';

const JablotronConstants = require('./const');

class JablotronServiceConfig {

    constructor(config) {
        this.id = config['id'];
        this.name = config['name'];
        this.username = config['username'];
        this.password = config['password'];
        this.pincode = config['pincode'];

        this.service_type = config['service_type'] ?? 'ja100';

        this.autoRefresh = JablotronConstants.readConfigValue(config, 'autoRefresh', JablotronConstants.DEFAULT_AUTO_REFRESH);
        this.pollInterval = JablotronConstants.readConfigValue(config, 'pollInterval', JablotronConstants.DEFAULT_POLL_INTERVAL);
        this.refreshOnStateChange = JablotronConstants.readConfigValue(config, 'refreshOnStateChange', JablotronConstants.DEFAULT_REFRESH_ON_STATE_CHANGE);
        this.debug = JablotronConstants.readConfigValue(config, 'debug', JablotronConstants.DEFAULT_DEBUG);
        this.debugPayload = JablotronConstants.readConfigValue(config, 'debugPayload', JablotronConstants.DEFAULT_DEBUG_PAYLOAD);
    }

    getId() {
        return this.id;
    }

    getName() {
        return this.name;
    }

    getUsername() {
        return this.username;
    }

    getPassword() {
        return this.password;
    }

    getPincode() {
        return this.pincode;
    }

    getServiceType() {
        return this.service_type;
    }

    isDebug() {
        return this.debug;
    }

    isDebugPayload() {
        return this.debugPayload;
    }

    isAutoRefresh() {
        return this.autoRefresh;
    }

    getPollInterval() {
        return this.pollInterval * 1000;
    }

    isRefreshOnStateChange() {
        return this.refreshOnStateChange;
    }
}

module.exports = JablotronServiceConfig;
