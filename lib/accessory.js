// noinspection JSUnusedGlobalSymbols,JSUnresolvedFunction,JSUnresolvedVariable

'use strict';

const JablotronConstants = require('./const');
const PackageJson = require('../package.json')

function JablotronAccessory(service, config, type) {
    this.jablotronService = service;
    this.log = service.getLog();
    this.name = config['name'];
    
    this.segmentId = JablotronConstants.readConfigValue(config, 'segment_id')
        || JablotronConstants.readConfigValue(config, 'cloud-component-id');
    this.alternateSegmentIds = [];
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

// noinspection JSUnusedLocalSymbols
JablotronAccessory.prototype = {
    getCharacteristic: function () {
        return this.jablotronService.getPlatform().getAPI().hap.Characteristic;
    },

    getService: function () {
        return this.jablotronService.getPlatform().getAPI().hap.Service;
    },

    getSegmentId: function () {
        return this.segmentId;
    },

    setSegmentId: function (segmentId) {
        this.segmentId = segmentId;
    },

    addAlternateSegmentId: function (segmentId) {
        if (segmentId != null && this.alternateSegmentIds.indexOf(segmentId) < 0
            && segmentId !== this.segmentId) {
            this.alternateSegmentIds.push(segmentId);
        }
    },

    matchesSegmentKey: function (key) {
        if (key === this.segmentId) {
            return true;
        }
        return this.alternateSegmentIds.indexOf(key) >= 0;
    },

    isPartiallyArmedAvailable: function() {
        return this.partialArmedConfigValue != null;
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
        return this.getCharacteristic().SecuritySystemCurrentState.DISARMED;
    },

    getArmedMapping: function() {
        return this.armedMapping;
    },

    getTriggeredStateMapping: function() {
        return this.getCharacteristic().SecuritySystemCurrentState.ALARM_TRIGGERED;
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
        const Characteristic = this.getCharacteristic();
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

    fetchState: function () {
        let self = this;
        return new Promise(function (resolve, reject) {
            self.jablotronService.getState(self, function (segmentState, segmentInformations) {
                let state = self.mapState(segmentState, segmentInformations);
                self.updateState(state, true);
                resolve(state);
            });
        });
    },

    getPGMState: function () {
        if (this.jablotronService.getServiceConfig().isAutoRefresh()) {
            return this.cachedState == null ? false : this.cachedState;
        }
        return this.fetchState();
    },

    getThermometerState: function () {
        if (this.jablotronService.getServiceConfig().isAutoRefresh()) {
            return this.cachedState == null ? JablotronConstants.DEFAULT_MIN_TEMPERATURE : this.cachedState;
        }
        return this.fetchState();
    },

    setPGMState: function (state) {
        let self = this;
        this.log("Setting PGM state: " + state);
        return new Promise(function (resolve, reject) {
            self.jablotronService.setState(self, state, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    getSectionState: function () {
        if (this.jablotronService.getServiceConfig().isAutoRefresh()) {
            return this.cachedState == null ? this.getDisarmedMapping() : this.cachedState;
        }
        return this.fetchState();
    },

    setSectionState: function (state) {
        let self = this;
        this.log("Setting section state: " + this.getSegmentId() + " => " + state);
        return new Promise(function (resolve, reject) {
            self.jablotronService.setState(self, state, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    mapContactSensorState: function(state) {
        const Characteristic = this.getCharacteristic();
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
            return segmentState || JablotronConstants.DEFAULT_MIN_TEMPERATURE;
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
        let state = this.mapState(segmentState, segmentInformations);
        this.updateState(state, true);

        if (callback != null) {
            callback(null, state);
        }
    },

    updateState: function (state, fullReport) {
        if (state == null) {
            this.jablotronService.debug("Skipping HomeKit update for " + this.getSegmentId() + " (null state)");
            return;
        }

        let update = (this.cachedState == null || this.cachedState !== state);
        if (!this.jablotronService.getServiceConfig().isAutoRefresh()) {
            update = true;
        }

        this.jablotronService.debug("About to update state for accessory " + this.getSegmentId() + " : update = " + update + "; cachedState = " + this.cachedState + "; newState = " + state + "; fullReport = " + fullReport);
        if (update) {
            const Characteristic = this.getCharacteristic();
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
        const Characteristic = this.getCharacteristic();
        const Service = this.getService();
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
        const Characteristic = this.getCharacteristic();
        const Service = this.getService();

        switch (this.getType()) {
            case JablotronConstants.ACCESSORY_OUTLET:
                this.service = new Service.Outlet(this.name);
                this.serviceInfo = this.getServiceInfo();

                this.service
                    .getCharacteristic(Characteristic.On)
                    .onSet(this.setPGMState.bind(this))
                    .onGet(this.getPGMState.bind(this));

                return [this.serviceInfo, this.service];
            case JablotronConstants.ACCESSORY_SWITCH:
                this.service = new Service.Switch(this.name);
                this.serviceInfo = this.getServiceInfo();

                this.service
                    .getCharacteristic(Characteristic.On)
                    .onSet(this.setPGMState.bind(this))
                    .onGet(this.getPGMState.bind(this));

                return [this.serviceInfo, this.service];
            case JablotronConstants.ACCESSORY_CONTACT_SENSOR:
                this.service = new Service.ContactSensor(this.name);
                this.serviceInfo = this.getServiceInfo();

                this.service
                    .getCharacteristic(Characteristic.ContactSensorState)
                    .onGet(this.getPGMState.bind(this));

                return [this.serviceInfo, this.service];
            case JablotronConstants.ACCESSORY_THERMOMETER:
                this.service = new Service.TemperatureSensor(this.name);
                this.serviceInfo = this.getServiceInfo();

                this.service
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .setProps({ minValue: this.minCachedState, maxValue: this.maxCachedState })
                    .onGet(this.getThermometerState.bind(this));

                return [this.serviceInfo, this.service];
            default:
                this.service = new Service.SecuritySystem(this.name);
                this.serviceInfo = this.getServiceInfo();

                this.service
                    .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                    .onGet(this.getSectionState.bind(this));

                this.service
                    .getCharacteristic(Characteristic.SecuritySystemTargetState)
                    .setProps({ validValues: this.getAvailableTargetStates() })
                    .onGet(this.getSectionState.bind(this))
                    .onSet(this.setSectionState.bind(this));

                return [this.serviceInfo, this.service];
        }
    }
}

module.exports = JablotronAccessory;
