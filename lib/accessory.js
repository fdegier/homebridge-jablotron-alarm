'use strict';

const JablotronConstants = require('./const');
const PackageJson = require('../package.json')

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

    this.armedMapping = this.mapModeToTargetState(JablotronConstants.readConfigValue(config, 'armedMode', JablotronConstants.MODE_AWAY));
    this.partiallyArmedMapping = this.mapModeToTargetState(JablotronConstants.readConfigValue(config, 'partiallyArmedMode', JablotronConstants.MODE_HOME));

    this.type = type;
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

    isPartiallyArmedAvailable: function() {
        return this.getKeyboardKey() != null;
    },

    getSectionType: function () {
        if (JablotronConstants.ACCESSORY_SECTION == this.type) {
            return JablotronConstants.JABLOTRON_SECTION;
        }

        return JablotronConstants.JABLOTRON_PGM;
    },

    getDisarmedMapping: function() {
        return Characteristic.SecuritySystemCurrentState.DISARMED;
    },

    getArmedMapping: function() {
        return this.armedMapping;
    },

    getTriggeredStateMapping: function() {
        return Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
    },

    getPartiallyArmedMapping: function() {
        return this.partiallyArmedMapping;
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

    mapModeToTargetState: function (mode) {
        switch (mode) {
            case JablotronConstants.MODE_HOME:
                return Characteristic.SecuritySystemCurrentState.STAY_ARM;
            case JablotronConstants.MODE_AWAY:
                return Characteristic.SecuritySystemCurrentState.AWAY_ARM;
            case JablotronConstants.MODE_NIGHT:
                return Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
            case JablotronConstants.MODE_OFF:
                return Characteristic.SecuritySystemCurrentState.DISARMED;
            default:
                this.log.error(`Unknown mode (${mode}).`);
                return -1;
        }
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
            let state = this.cachedState == null ? this.getDisarmedMapping() : this.cachedState;
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
            return JablotronConstants.isJablotronArmed(segmentState);
        } else {
            let state = this.getDisarmedMapping();
            if (JablotronConstants.isJablotronPartiallyArmed(segmentState)) {
                state = this.getPartiallyArmedMapping();
            } else if (JablotronConstants.isJablotronArmed(segmentState)) {
                state = this.getArmedMapping();
            } else if (segmentState == "triggered") {
                state = this.getTriggeredStateMapping();
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

                if (fullReport && state != this.getTriggeredStateMapping()) {
                    this.updateServiceCharacteristic(Characteristic.SecuritySystemTargetState, state);
                }
            }
        }
    },

    getServiceInfo: function() {
        let info = new Service.AccessoryInformation();
        info.setCharacteristic(Characteristic.Identify, true);
        info.setCharacteristic(Characteristic.Manufacturer, PackageJson.author);
        info.setCharacteristic(Characteristic.Model, JablotronConstants.JABLOTRON_MODEL);
        info.setCharacteristic(Characteristic.Name, PackageJson.name);
        info.setCharacteristic(Characteristic.SerialNumber, 'JA100');
        info.setCharacteristic(Characteristic.FirmwareRevision, PackageJson.version);
        return info;
    },

    getAvailableTargetStates: function() {
        let result = [];
        result.push(this.getDisarmedMapping());
        if (this.isPartiallyArmedAvailable()) {
            result.push(this.getPartiallyArmedMapping());
        }
        result.push(this.getArmedMapping());

        this.jablotronService.debug("Available target states for " + this.name + " => " + result);
        return result;
    },

    getServices: function () {
        if (JablotronConstants.ACCESSORY_OUTLET == this.type) {
            this.service = new Service.Outlet(this.name);
            this.serviceInfo = this.getServiceInfo();

            this.service
                .getCharacteristic(Characteristic.On)
                .on('set', this.setPGMState.bind(this))
                .on('get', this.getPGMState.bind(this));

            return [this.serviceInfo, this.service];
        } else if (JablotronConstants.ACCESSORY_SWITCH == this.type) {
            this.service = new Service.Switch(this.name);
            this.serviceInfo = this.getServiceInfo();

            this.service
                .getCharacteristic(Characteristic.On)
                .on('set', this.setPGMState.bind(this))
                .on('get', this.getPGMState.bind(this));

            return [this.serviceInfo, this.service];
        } else {
            this.service = new Service.SecuritySystem(this.name);
            this.serviceInfo = this.getServiceInfo();

            this.service
                .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .on('get', this.getSectionState.bind(this));

            this.service
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .setProps({ validValues: this.getAvailableTargetStates() })
                .on('get', this.getSectionState.bind(this))
                .on('set', this.setSectionState.bind(this));

            return [this.serviceInfo, this.service];
        }
    }
}

module.exports = JablotronAccessory;
