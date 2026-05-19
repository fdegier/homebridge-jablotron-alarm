'use strict';

const JablotronServiceConfig = require('./service-config');
const JablotronAccessory = require('./accessory');
const JablotronConstants = require('./const');
const Jablotron = require('./jablotron');
const moment = require('moment');

class JablotronService {

    constructor(platform, config) {
        this.platform = platform;
        this.log = platform.getLog();
        this.config = config;
        this.refreshingState = false;
        this.lastRefreshed = 0;

        this.serviceConfig = new JablotronServiceConfig(config);
        this.jablotron = new Jablotron(this);

        this.pgmAccessory = false;
        this.thermometerAccessory = false;
    }

    getLog() {
        return this.log;
    }

    getPlatform() {
        return this.platform;
    }

    getId() {
        return this.serviceConfig.getId();
    }

    getServiceConfig() {
        return this.serviceConfig;
    }

    hasPGMAccessory() {
        return this.pgmAccessory;
    }

    hasThermometerAccessory() {
        return this.thermometerAccessory;
    }

    findAccessory(key) {
        const result = [];
        for (let i = 0; i < this.devices.length; i++) {
            const accessory = this.devices[i];
            if (key === accessory.getSegmentId()) {
                result.push(accessory);
            }
        }
        return result;
    }

    createAccessories() {
        this.devices = [];
        this.pgmAccessory = false;
        this.thermometerAccessory = false;

        // Sections
        const sections = this.config['sections'] || [];
        for (let i = 0; i < sections.length; i++) {
            const accConfig = sections[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_SECTION));
        }

        // Switches
        const switches = this.config['switches'] || [];
        for (let i = 0; i < switches.length; i++) {
            const accConfig = switches[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_SWITCH));
            this.pgmAccessory = true;
        }

        // Outlets
        const outlets = this.config['outlets'] || [];
        for (let i = 0; i < outlets.length; i++) {
            const accConfig = outlets[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_OUTLET));
            this.pgmAccessory = true;
        }

        // Thermometers
        const thermometers = this.config['thermometers'] || [];
        for (let i = 0; i < thermometers.length; i++) {
            const accConfig = thermometers[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_THERMOMETER));
            this.thermometerAccessory = true;
        }

        // Contact Sensors
        const contactSensors = this.config['contact_sensors'] || [];
        for (let i = 0; i < contactSensors.length; i++) {
            const accConfig = contactSensors[i];
            this.devices.push(new JablotronAccessory(this, accConfig, JablotronConstants.ACCESSORY_CONTACT_SENSOR));
            this.pgmAccessory = true;
        }

        return this.devices;
    }

    startRefresh() {
        this.debug(`Refreshing status for Jablotron service ${this.getId()}`);
        this.refreshingState = true;
        return this;
    }

    finishRefresh(timestamp) {
        this.debug(`Status refreshed for Jablotron service ${this.getId()}`);
        this.refreshingState = false;
        this.lastRefreshed = timestamp;
    }

    refreshState() {
        if (this.refreshingState) {
            this.debug(`Jablotron service ${this.getId()} is already refreshing its status => ignoring`);
            return;
        }

        const currentTimestamp = moment().valueOf();
        if (currentTimestamp < this.lastRefreshed + this.serviceConfig.getPollInterval()) {
            this.debug(`Jablotron service ${this.getId()} status was last refreshed shortly before => ignoring`);
            return;
        }

        const self = this.startRefresh();

        this.jablotron.getAccessoryStates((segmentId, segmentStatus, segmentInformations) => {
            if (segmentId != null) {
                const accessories = self.findAccessory(segmentId);
                for (let i = 0; i < accessories.length; i++) {
                    const accessory = accessories[i];
                    if (accessory.isPGM) {
                        self.debug(`Accessory state for segment ${segmentId} = ${segmentStatus}`);
                        accessory.mapAndUpdateState(segmentStatus, segmentInformations, null);
                    }
                }
            } else {
                self.finishRefresh(currentTimestamp);
            }
        });
    }

    // ==================== MODERNE ASYNC METHODES ====================

    async getState(accessory) {
        return new Promise((resolve, reject) => {
            this.jablotron.getAccessoryState(accessory, (segmentState, segmentInformations) => {
                resolve({ segmentState, segmentInformations });
            });
        });
    }

    async setState(accessory, state) {
        const cachedState = accessory.getCachedState();

        return new Promise((resolve, reject) => {
            const done = (success) => {
                const finalState = success ? state : cachedState;

                if (this.serviceConfig.isRefreshOnStateChange()) {
                    this.lastRefreshed = 0;
                    this.refreshState();
                }

                accessory.updateState(finalState, false);
                resolve(finalState);
            };

            if (accessory.isPGM()) {
                if (state === true) {
                    this.jablotron.activateAcccessory(accessory, (success) => done(success));
                } else {
                    this.jablotron.deactivateAccessory(accessory, (success) => done(success));
                }
            } else {
                if (state === accessory.getDisarmedMapping()) {
                    this.jablotron.deactivateAccessory(accessory, (success) => done(success));
                } else if (state === accessory.getPartiallyArmedMapping()) {
                    this.jablotron.partiallyActivateAccessory(accessory, (success) => done(success));
                } else if (state === accessory.getArmedMapping()) {
                    this.jablotron.activateAcccessory(accessory, (success) => done(success));
                } else {
                    this.log.error(`Unsupported state = ${state}`);
                    reject(new Error(`Unsupported state: ${state}`));
                }
            }
        });
    }

    // ==================== Oude methodes (voor backward compatibiliteit) ====================

    updateAndRefreshOnStateChange(accessory, state, callback) {
        accessory.updateState(state, false);
        if (callback) callback(null, state);

        if (this.serviceConfig.isRefreshOnStateChange()) {
            this.lastRefreshed = 0;
            this.refreshState();
        }
    }

    debug(msg) {
        if (this.serviceConfig.isDebug()) {
            this.log(msg);
        }
    }

    debugPayload(msg) {
        if (this.serviceConfig.isDebugPayload()) {
            this.log(msg);
        }
    }

    initialise() {
        this.log.info(`Initialising Jablotron service ${this.getId()}`);
        this.jablotron.getServices();

        if (this.serviceConfig.isAutoRefresh()) {
            this.refreshState();

            const self = this;
            setInterval(() => {
                self.refreshState();
            }, this.serviceConfig.getPollInterval());
        }
    }
}

module.exports = JablotronService;