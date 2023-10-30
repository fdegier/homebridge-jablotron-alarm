// noinspection JSUnusedGlobalSymbols,JSUnresolvedFunction,JSUnresolvedVariable

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
    
    this.segmentId = JablotronConstants.readConfigValue(config, 'segment_id');
    this.reversedStatus = JablotronConstants.readConfigValue(config, 'reversed_status', JablotronConstants.DEFAULT_REVERSED_STATUS);

    this.armedMapping = this.mapModeToTargetState(JablotronConstants.readConfigValue(config, 'armedMode', JablotronConstants.MODE_AWAY));
    this.partialArmedConfigValue = JablotronConstants.readConfigValue(config, 'partiallyArmedMode', null);
    this.partiallyArmedMapping = this.mapModeToTargetState(JablotronConstants.readConfigValue(config, 'partiallyArmedMode', JablotronConstants.MODE_HOME));

    this.type = type;
    this.cachedState = null;

    if (this.isThermometer()) {
        this.minCachedState = JablotronConstants.readConfigValue(config, 'min_temperature', JablotronConstants.DEFAULT_MIN_TEMPERATURE);
        this.maxCachedState = JablotronConstants.readConfigValue(config, 'max_temperature', JablotronConstants.DEFAULT_MAX_TEMPERATURE);
    } else {
        this.minCachedState = null;
        this.maxCachedState = null;
    }
}

JablotronAccessory.prototype = {
    getSegmentId: function () {
        return this.segmentId;
    },

    isPartiallyArmedAvailable: function() {
        if ( this.partialArmedConfigValue == null) {
            return false;
        }
        return true;
    },

    getType: function() {
        return this.type;
    },

    getSectionType: function () {
        switch (this.getType()) {
            case JablotronConstants.ACCESSORY_SECTION:
                return JablotronConstants.JABLOTRON_SECTION;
            case JablotronConstants.ACCESSORY_THERMOMETER:
                return JablotronConstants.JABLOTRON_THERMOMETER;
            default:
                return JablotronConstants.JABLOTRON_PGM;
        }
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

    isSection: function () {
        return JablotronConstants.JABLOTRON_SECTION === this.getSectionType();
    },

    isPGM: function () {
        return JablotronConstants.JABLOTRON_PGM === this.getSectionType();
    },

    isContactSensor() {
        return JablotronConstants.ACCESSORY_CONTACT_SENSOR === this.getType();
    },

    isThermometer: function() {
        return JablotronConstants.JABLOTRON_THERMOMETER === this.getSectionType();
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
            this.jablotronService.getState(this, function (segmentState, segmentInformations) {
                self.mapAndUpdateState(segmentState, segmentInformations, callback);
            });
        }
    },

    getThermometerState: function(callback) {
        if (this.jablotronService.getServiceConfig().isAutoRefresh()) {
            let state = this.cachedState == null ? JablotronConstants.DEFAULT_MIN_TEMPERATURE : this.cachedState;
            callback(null, state);
        } else {
            let self = this;
            this.jablotronService.getState(this, function (segmentState, segmentInformations) {
                self.mapAndUpdateState(segmentState, segmentInformations, callback);
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
            this.jablotronService.getState(this, function (segmentState, segmentInformations) {
                self.mapAndUpdateState(segmentState, segmentInformations, callback);
            });
        }
    },

    setSectionState: function (state, callback) {
        this.log("Setting section state: " + this.getSegmentId() + " => " + state);
        this.jablotronService.setState(this, state, callback);
    },

    mapContactSensorState: function(state) {
        if (this.reversedStatus === true) {
            return state ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
        }
        return state ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED;
    },

    mapState: function (segmentState, segmentInformations) {
        if (this.isPGM() && this.getSegmentId().startsWith("PG-")) {
            let state = JablotronConstants.isAccessoryArmed(segmentState);
            if (this.isContactSensor()) {
                return this.mapContactSensorState(state);
            }
            return state;
        } else if (this.isThermometer()) {
            let state = JablotronConstants.DEFAULT_MIN_TEMPERATURE;

            let informations = segmentInformations || {};
            for (let i = 0; i < informations.length; i++) {
                let information = informations[i];
                if (JablotronConstants.INFORMATION_TEMPERATURE === information['type']) {
                    state = information['value'];
                    break;
                }
            }
            return state;
        } else {
            let state = this.getDisarmedMapping();
            if (JablotronConstants.isJablotronPartiallyArmed(segmentState)) {
                state = this.getPartiallyArmedMapping();
            } else if (JablotronConstants.isJablotronArmed(segmentState)) {
                state = this.getArmedMapping();
            } else if (JablotronConstants.isJablotronTriggered(segmentState)) {
                state = this.getTriggeredStateMapping();
            }

            return state;
        }
    },

    mapAndUpdateState: function (segmentState, segmentInformations, callback) {
        console.log("Mapping and updating state for accessory " + this.getSegmentId() + " : " + segmentState);
        let state = this.mapState(segmentState, segmentInformations);
        console.log("Mapped state: " + state);
        this.updateState(state, true);

        if (callback != null) {
            callback(null, state);
        }
    },

    updateState: function (state, fullReport) {
        let update = (this.cachedState == null || this.cachedState !== state);
        if (!this.jablotronService.getServiceConfig().isAutoRefresh()) {
            update = true;
        }

        this.jablotronService.debug("About to update state for accessory " + this.getSegmentId() + " : update = " + update + "; cachedState = " + this.cachedState + "; newState = " + state, "; fullReport = " + fullReport);
        if (update) {
            if (this.isPGM()) {
                if (this.isContactSensor()) {
                    this.updateServiceCharacteristic(Characteristic.ContactSensorState, state);
                } else {
                    this.updateServiceCharacteristic(Characteristic.On, state);
                }
                this.updateCachedState(state);
            } else if (this.isThermometer()) {
                this.updateServiceCharacteristic(Characteristic.CurrentTemperature, state);
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
        switch (this.getType()) {
            case JablotronConstants.ACCESSORY_OUTLET:
                this.service = new Service.Outlet(this.name);
                this.serviceInfo = this.getServiceInfo();

                this.service
                    .getCharacteristic(Characteristic.On)
                    .on('set', this.setPGMState.bind(this))
                    .on('get', this.getPGMState.bind(this));

                return [this.serviceInfo, this.service];
            case JablotronConstants.ACCESSORY_SWITCH:
                this.service = new Service.Switch(this.name);
                this.serviceInfo = this.getServiceInfo();

                this.service
                    .getCharacteristic(Characteristic.On)
                    .on('set', this.setPGMState.bind(this))
                    .on('get', this.getPGMState.bind(this));

                return [this.serviceInfo, this.service];
            case JablotronConstants.ACCESSORY_CONTACT_SENSOR:
                this.service = new Service.ContactSensor(this.name);
                this.serviceInfo = this.getServiceInfo();

                this.service
                    .getCharacteristic(Characteristic.ContactSensorState)
                    .on('get', this.getPGMState.bind(this));

                return [this.serviceInfo, this.service];
            case JablotronConstants.ACCESSORY_THERMOMETER:
                this.service = new Service.TemperatureSensor(this.name);
                this.serviceInfo = this.getServiceInfo();

                this.service
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .setProps({ minValue: this.minCachedState, maxValue: this.maxCachedState })
                    .on("get", this.getThermometerState.bind(this));

                return [this.serviceInfo, this.service];
            default:
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
