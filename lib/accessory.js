'use strict';

const JablotronConstants = require('./const');

let Characteristic, Service;

function JablotronAccessory(service, config, type) {
    Characteristic = service.getPlatform().getAPI().hap.Characteristic;
    Service = service.getPlatform().getAPI().hap.Service;

    this.jablotronService = service;
    this.log = service.getLog();

    this.name = config['name'];
    this.segmentId = JablotronConstants.readConfigValue(config, 'segment_id', JablotronConstants.DEFAULT_SEGMENT_ID);
    this.segmentKey = JablotronConstants.readConfigValue(config, 'segment_key', JablotronConstants.DEFAULT_SEGMENT_KEY);
    this.keyboardKey = JablotronConstants.readConfigValue(config, 'keyboard_key', JablotronConstants.DEFAULT_KEYBOARD_KEY);

    this.type = type;
    this.partialSetMapping = Characteristic.SecuritySystemCurrentState.STAY_ARM;
    this.cachedState = null;
}

JablotronAccessory.prototype = {
    getSegmentId: function () {
        return this.segmentId;
    },

    getSegmentKey: function () {
        return this.segmentKey;
    },

    getKeyboardKey: function () {
        return this.keyboardKey;
    },

    getSectionType: function () {
        if (JablotronConstants.ACCESSORY_SECTION == this.type) {
            return JablotronConstants.JABLOTRON_SECTION;
        }

        return JablotronConstants.JABLOTRON_PGM;
    },

    isPGM: function () {
        return JablotronConstants.JABLOTRON_PGM == this.getSectionType();
    },

    updateServiceCharacteristic: function (characteristic, value) {
        this.service.updateCharacteristic(characteristic, value);
    },

    updateCachedState: function (newState) {
        this.cachedState = newState;
    },

    getCachedState: function () {
        return this.cachedState;
    },

    getPGMState: function (callback) {
        if (this.jablotronService.getServiceConfig().isAutoRefresh()) {
            let state = this.cachedState == null ? false : this.cachedState;
            callback(null, state);
        } else {
            let self = this;
            this.jablotronService.getState(this, function (segmentState) {
                self.mapAndUpdateState(segmentState, callback);
            });
        }
    },

    setPGMState: function (state, callback) {
        this.log("Setting PGM state: " + state);
        this.jablotronService.setState(this, state, callback);
    },

    getSectionState: function (callback) {
        if (this.jablotronService.getServiceConfig().isAutoRefresh()) {
            let state = this.cachedState == null ? Characteristic.SecuritySystemCurrentState.DISARMED : this.cachedState;
            callback(null, state);
        } else {
            let self = this;
            this.jablotronService.getState(this, function (segmentState) {
                self.mapAndUpdateState(segmentState, callback);
            });
        }
    },

    setSectionState: function (state, callback) {
        this.log("Setting section state: " + this.getSegmentKey() + " => " + state);
        this.jablotronService.setState(this, state, callback);
    },

    mapState: function (segmentState) {
        if (this.isPGM()) {
            let state = JablotronConstants.isJablotronArmed(segmentState);
            return state;
        } else {
            let state = Characteristic.SecuritySystemCurrentState.DISARMED;
            if (JablotronConstants.isJablotronPartiallyArmed(segmentState)) {
                state = this.partialSetMapping;
            } else if (JablotronConstants.isJablotronArmed(segmentState)) {
                state = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
            }

            return state;
        }
    },

    mapAndUpdateState: function (segmentState, callback) {
        let state = this.mapState(segmentState);
        this.updateState(state, true);

        if (callback != null) {
            callback(null, state);
        }
    },

    updateState: function (state, fullReport) {
        let update = (this.cachedState == null || this.cachedState != state);
        if (!this.jablotronService.getServiceConfig().isAutoRefresh()) {
            update = true;
        }

        this.jablotronService.debug("About to update state for accessory [" + this.getSegmentKey() + "] : update = " + update + "; cachedState = " + this.cachedState + "; newState = " + state, "; fullReport = " + fullReport);
        if (update) {
            if (this.isPGM()) {
                this.updateServiceCharacteristic(Characteristic.On, state);
                this.updateCachedState(state);
            } else {
                this.updateServiceCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                this.updateCachedState(state);

                if (fullReport) {
                    this.updateServiceCharacteristic(Characteristic.SecuritySystemTargetState, state);
                }
            }
        }
    },

    getServices: function () {
        if (JablotronConstants.ACCESSORY_OUTLET == this.type) {
            this.service = new Service.Outlet(this.name);

            this.service
                .getCharacteristic(Characteristic.On)
                .on('set', this.setPGMState.bind(this))
                .on('get', this.getPGMState.bind(this));

            return [this.service];
        } else if (JablotronConstants.ACCESSORY_SWITCH == this.type) {
            this.service = new Service.Switch(this.name);

            this.service
                .getCharacteristic(Characteristic.On)
                .on('set', this.setPGMState.bind(this))
                .on('get', this.getPGMState.bind(this));

            return [this.service];
        } else {
            this.service = new Service.SecuritySystem(this.name);

            this.service
                .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .on('get', this.getSectionState.bind(this));

            this.service
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .on('get', this.getSectionState.bind(this))
                .on('set', this.setSectionState.bind(this));

            return [this.service];
        }
    }
}

module.exports = JablotronAccessory;
