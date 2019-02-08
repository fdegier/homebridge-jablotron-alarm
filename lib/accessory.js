'use strict';

const JablotronConstants = require('./const');

var Characteristic, Service;

function JablotronAccessory(service, config, type) {
    Characteristic = service.getPlatform().getAPI().hap.Characteristic;
    Service = service.getPlatform().getAPI().hap.Service;

    this.jablotronService = service;
    this.log = service.getLog();
    this.segmentId = config['segment_id'] || 'STATE_1';
    this.segmentKey = config['segment_key'] || 'section_1';
    this.keyboardKey = config['keyboard_key'] || null;
    this.name = config['name'];
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

    updateCharacteristic: function (characteristic, value) {
        this.service.getCharacteristic(characteristic).updateValue(value);
    },

    updateCachedState: function (newState) {
        this.cachedState = newState;
    },

    getCachedState: function () {
        return this.cachedState;
    },

    getPGMState: function (callback) {
        var state = this.cachedState == null ? false : this.cachedState;
        callback(null, state);
    },

    setPGMState: function (state, callback) {
        this.log("Setting PGM state: " + state);
        this.jablotronService.setState(this, state, callback);
    },

    getSectionState: function (callback) {
        var state = this.cachedState == null ? Characteristic.SecuritySystemCurrentState.DISARMED : this.cachedState;
        callback(null, state);
    },

    setSectionState: function (state, callback) {
        this.log("Setting section state: " + state);
        this.jablotronService.setState(this, state, callback);
    },

    mapAndUpdateState: function (segmentState) {
        if (this.isPGM()) {
            var state = (segmentState == "set" ? true : false);
            this.updateState(state);
        } else {
            var state = Characteristic.SecuritySystemCurrentState.DISARMED;
            if (segmentState == "partialSet") {
                state = this.partialSetMapping;
            } else if (segmentState == "set") {
                state = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
            }
            this.updateState(state);
        }
    },

    updateState: function (state) {
        if (this.isPGM()) {
            if (this.cachedState == null || this.cachedState != state) {
                this.updateCharacteristic(Characteristic.On, state);
                this.updateCachedState(state);
            }
        } else {
            if (this.cachedState == null || this.cachedState != state) {
                this.updateCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                this.updateCachedState(state);
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
