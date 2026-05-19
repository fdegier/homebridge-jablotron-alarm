'use strict';

const JablotronConstants = require('./const');
const PackageJson = require('../package.json');

let Characteristic, Service;

class JablotronAccessory {

    constructor(service, config, type) {
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

    getSegmentId() {
        return this.segmentId;
    }

    isPartiallyArmedAvailable() {
        return this.partialArmedConfigValue != null;
    }

    getType() {
        return this.type;
    }

    getSectionType() {
        switch (this.getType()) {
            case JablotronConstants.ACCESSORY_SECTION:
                return JablotronConstants.JABLOTRON_SECTION;
            case JablotronConstants.ACCESSORY_THERMOMETER:
                return JablotronConstants.JABLOTRON_THERMOMETER;
            default:
                return JablotronConstants.JABLOTRON_PGM;
        }
    }

    getDisarmedMapping() {
        return Characteristic.SecuritySystemCurrentState.DISARMED;
    }

    getArmedMapping() {
        return this.armedMapping;
    }

    getTriggeredStateMapping() {
        return Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
    }

    getPartiallyArmedMapping() {
        return this.partiallyArmedMapping;
    }

    isSection() {
        return JablotronConstants.JABLOTRON_SECTION === this.getSectionType();
    }

    isPGM() {
        return JablotronConstants.JABLOTRON_PGM === this.getSectionType();
    }

    isContactSensor() {
        return JablotronConstants.ACCESSORY_CONTACT_SENSOR === this.getType();
    }

    isThermometer() {
        return JablotronConstants.JABLOTRON_THERMOMETER === this.getSectionType();
    }

    updateServiceCharacteristic(characteristic, value) {
        this.service.updateCharacteristic(characteristic, value);
    }

    updateCachedState(newState) {
        this.cachedState = newState;
    }

    getCachedState() {
        return this.cachedState;
    }

    mapModeToTargetState(mode) {
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
    }

    // ==================== MODERNE ASYNC GETTERS (vereenvoudigd) ====================

    async getPGMState() {
        if (this.jablotronService.getServiceConfig().isAutoRefresh()) {
            return this.cachedState == null ? false : this.cachedState;
        }

        const { segmentState, segmentInformations } = await this.jablotronService.getState(this);
        const result = this.mapState(segmentState, segmentInformations);
        this.updateState(result, true);
        return result;
    }

    async getThermometerState() {
        if (this.jablotronService.getServiceConfig().isAutoRefresh()) {
            return this.cachedState == null ? JablotronConstants.DEFAULT_MIN_TEMPERATURE : this.cachedState;
        }

        const { segmentState, segmentInformations } = await this.jablotronService.getState(this);
        const result = this.mapState(segmentState, segmentInformations);
        this.updateState(result, true);
        return result;
    }

    async getSectionState() {
        if (this.jablotronService.getServiceConfig().isAutoRefresh()) {
            return this.cachedState == null ? this.getDisarmedMapping() : this.cachedState;
        }

        const { segmentState, segmentInformations } = await this.jablotronService.getState(this);
        const result = this.mapState(segmentState, segmentInformations);
        this.updateState(result, true);
        return result;
    }

    // ==================== SETTERS (vereenvoudigd) ====================

    async setPGMState(value) {
        this.log("Setting PGM state: " + value);
        return await this.jablotronService.setState(this, value);
    }

    async setSectionState(value) {
        this.log("Setting section state: " + this.getSegmentId() + " => " + value);
        return await this.jablotronService.setState(this, value);
    }

    // ==================== Hulpmethodes ====================

    mapContactSensorState(state) {
        if (this.reversedStatus === true) {
            return state ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
        }
        return state ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED;
    }

    mapState(segmentState, segmentInformations) {
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
    }

    mapAndUpdateState(segmentState, segmentInformations, callback) {
        const state = this.mapState(segmentState, segmentInformations);
        this.updateState(state, true);
        if (callback) callback(null, state);
    }

    updateState(state, fullReport) {
        let update = (this.cachedState == null || this.cachedState !== state);
        if (!this.jablotronService.getServiceConfig().isAutoRefresh()) {
            update = true;
        }

        this.jablotronService.debug(
            `About to update state for accessory ${this.getSegmentId()} : update = ${update}; cachedState = ${this.cachedState}; newState = ${state}; fullReport = ${fullReport}`
        );

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
    }

    getServiceInfo() {
        const info = new Service.AccessoryInformation();
        info.setCharacteristic(Characteristic.Identify, true);
        info.setCharacteristic(Characteristic.Manufacturer, PackageJson.author);
        info.setCharacteristic(Characteristic.Model, JablotronConstants.JABLOTRON_MODEL);
        info.setCharacteristic(Characteristic.Name, PackageJson.name);
        info.setCharacteristic(Characteristic.SerialNumber, 'JA100');
        info.setCharacteristic(Characteristic.FirmwareRevision, PackageJson.version);
        return info;
    }

    getAvailableTargetStates() {
        const result = [];
        result.push(this.getDisarmedMapping());
        if (this.isPartiallyArmedAvailable()) {
            result.push(this.getPartiallyArmedMapping());
        }
        result.push(this.getArmedMapping());

        this.jablotronService.debug("Available target states for " + this.name + " => " + result);
        return result;
    }

    getServices() {
        switch (this.getType()) {
            case JablotronConstants.ACCESSORY_OUTLET:
                this.service = new Service.Outlet(this.name);
                this.serviceInfo = this.getServiceInfo();

                this.service
                    .getCharacteristic(Characteristic.On)
                    .onGet(this.getPGMState.bind(this))
                    .onSet(this.setPGMState.bind(this));
                return [this.serviceInfo, this.service];

            case JablotronConstants.ACCESSORY_SWITCH:
                this.service = new Service.Switch(this.name);
                this.serviceInfo = this.getServiceInfo();

                this.service
                    .getCharacteristic(Characteristic.On)
                    .onGet(this.getPGMState.bind(this))
                    .onSet(this.setPGMState.bind(this));
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