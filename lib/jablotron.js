// noinspection JSUnresolvedFunction,NpmUsedModulesInstalled,JSUnresolvedVariable

'use strict';

const JablotronClient = require('./jablotron-client');
const JablotronConstants = require('./const');

function Jablotron(service) {
    this.service = service;
    this.client = new JablotronClient(service.getLog());
    this.sessionId = null;
}

Jablotron.prototype = {

    fetchSessionId: function (callback) {
        if (this.sessionId != null) {
            callback(this.sessionId);
            return;
        }

        const payload = {
            'login': this.service.getServiceConfig().getUsername(),
            'password': this.service.getServiceConfig().getPassword()
        };

        const self = this;

        this.client.doRequest('/userAuthorize.json', payload, null, true,
            function (response) {
                self.sessionId = response;
                callback(response);
            },
            function (error) {
                self.tryHandleError(error);
                callback(null);
            }
        );
    },

    parseResponseData: function (response) {
        const data = response['data'];
        const states = [];

        if (!JablotronConstants.isValidVariable(data)) {
            this.service.log('WARN: Unexpected response: ' + JSON.stringify(response, null, 2));
            return null;
        }

        // Handle alarm events
        const serviceEvents = data['service-states']?.['events'];
        if (JablotronConstants.isValidVariable(serviceEvents) && Array.isArray(serviceEvents)) {
            for (let i = 0; i < serviceEvents.length; i++) {
                const event = serviceEvents[i];
                if (event['type'] === 'ALARM') {
                    const sectionName = event['message'].split(", Section ")[1];
                    if (data['sections']) {
                        const sectionId = data['sections'].find(el => el['name'] === sectionName);
                        if (sectionId) {
                            this.service.log(`ALARM IN SECTION: ${sectionId['cloud-component-id']}`);
                            states.push({
                                "cloud-component-id": sectionId['cloud-component-id'],
                                "state": JablotronConstants.JABLOTRON_TRIGGERED
                            });
                        }
                    }
                } else {
                    this.service.log("WARNING: " + event['message']);
                }
            }
        }

        // Handle states
        if (JablotronConstants.isValidVariable(data['states']) && Array.isArray(data['states'])) {
            for (let i = 0; i < data['states'].length; i++) {
                const state = data['states'][i];
                const idKey = state['temperature'] ? 'object-device-id' : 'cloud-component-id';

                const index = states.findIndex(el => el['cloud-component-id'] === state[idKey]);
                if (index === -1) {
                    states.push({
                        "cloud-component-id": state[idKey],
                        "state": state['temperature'] || state
                    });
                }
            }
            return states;
        }

        return states.length > 0 ? states : null;
    },

    getAccessoryState: function (accessory, callback) {
        const self = this;
        const payload = {
            "connect-device": true,
            "list-type": "FULL",
            "service-id": this.service.getId(),
            "service-states": true
        };

        this.fetchSessionId(function (sessionId) {
            if (sessionId) {
                // Note: 'this.service_type' was undefined in original code. Using 'JA100' as fallback.
                self.client.doAuthenticatedRequest('/JA100/sectionsGet.json', payload, sessionId,
                    function (response) {
                        const responseData = self.parseResponseData(response);
                        if (responseData && responseData.length > 0) {
                            responseData.forEach(segment => {
                                if (segment['cloud-component-id'] === accessory.getSegmentId()) {
                                    callback(segment['state']);
                                }
                            });
                        }
                    },
                    function (error) {
                        if (self.tryHandleError(error)) {
                            self.getAccessoryState(accessory, callback);
                        }
                    }
                );
            }
        });
    },

    getAccessoryStates: function (callback) {
        const self = this;
        const payload = {
            "connect-device": true,
            "list-type": "FULL",
            "service-id": this.service.getId(),
            "service-states": true
        };

        this.fetchSessionId(function (sessionId) {
            if (!sessionId) {
                callback(null, null, null);
                return;
            }

            // Programmable Gates
            self.client.doAuthenticatedRequest('/JA100/programmableGatesGet.json', payload, sessionId,
                function (response) {
                    const responseData = self.parseResponseData(response);
                    self.service.debugPayload("All available Programmable gates: " + JSON.stringify(response['data']?.['programmableGates'], null, 2));
                    if (responseData) {
                        responseData.forEach(gate => callback(gate['cloud-component-id'], gate['state']));
                    }
                },
                function (error) {
                    if (self.tryHandleError(error)) self.getAccessoryStates(callback);
                }
            );

            // Sections
            self.client.doAuthenticatedRequest('/JA100/sectionsGet.json', payload, sessionId,
                function (response) {
                    const responseData = self.parseResponseData(response);
                    self.service.debugPayload("All available Sections: " + JSON.stringify(response['data']?.['sections'], null, 2));
                    if (responseData) {
                        responseData.forEach(segment => callback(segment['cloud-component-id'], segment['state']));
                    }
                },
                function (error) {
                    if (self.tryHandleError(error)) self.getAccessoryStates(callback);
                }
            );

            // Thermometers
            self.client.doAuthenticatedRequest('/JA100/thermoDevicesGet.json', payload, sessionId,
                function (response) {
                    const responseData = self.parseResponseData(response);
                    self.service.debugPayload("All available thermo devices: " + JSON.stringify(response['data'], null, 2));
                    if (responseData) {
                        responseData.forEach(device => callback(device['cloud-component-id'], device['state']));
                    }
                },
                function (error) {
                    if (self.tryHandleError(error)) self.getAccessoryStates(callback);
                }
            );
        });
    },

    getServices: function () {
        if (!this.service.getLog()) return;

        const self = this;
        const payload = {
            "list-type": "EXTENDED",
            "visibility": "DEFAULT"
        };

        this.fetchSessionId(function (sessionId) {
            if (sessionId) {
                self.client.doAuthenticatedRequest('/JA100/serviceListGet.json', payload, sessionId,
                    function (response) {
                        self.service.debugPayload("All available Services: " + JSON.stringify(response['data']?.['services'], null, 2));
                    }
                );
            }
        });
    },

    changeAccessoryState: function (accessory, state, callback) {
        const segmentId = accessory.getSegmentId();
        let action = 'CONTROL-SECTION';

        if (accessory.isPGM() && !segmentId.startsWith('SEC-')) {
            action = 'CONTROL-PG';
            if (state === JablotronConstants.JABLOTRON_ARMED) {
                state = JablotronConstants.ACCESSORY_ARMED;
            } else if (state === JablotronConstants.JABLOTRON_DISARMED) {
                state = JablotronConstants.ACCESSORY_DISARMED;
            } else {
                this.service.log.warn("Unexpected state: " + state);
                callback(false);
                return;
            }
        }

        const payload = {
            'service-id': this.service.getId(),
            'authorization': {
                'authorization-code': this.service.getServiceConfig().getPincode()
            },
            'control-components': [{
                'actions': {
                    'action': action,
                    'value': state,
                    'force': true
                },
                'component-id': segmentId
            }]
        };

        this.service.log(`Switching section ${segmentId} to new state: ${state}`);

        const self = this;
        this.fetchSessionId(function (sessionId) {
            if (sessionId) {
                self.client.doAuthenticatedRequest('/controlComponent.json', payload, sessionId,
                    function (response) {
                        const states = response['data']?.['states'] || [];
                        const found = states.some(el => el['component-id'] === accessory.getSegmentId());
                        self.service.debug(`Was accessory state changed? ${found ? "Yes" : "No"}`);
                        callback(found);
                    },
                    function (error) {
                        if (self.tryHandleError(error)) {
                            self.changeAccessoryState(accessory, state, callback);
                        } else {
                            callback(false);
                        }
                    }
                );
            } else {
                callback(false);
            }
        });
    },

    deactivateAccessory: function (accessory, callback) {
        this.changeAccessoryState(accessory, JablotronConstants.JABLOTRON_DISARMED, callback);
    },

    activateAcccessory: function (accessory, callback) {
        this.changeAccessoryState(accessory, JablotronConstants.JABLOTRON_ARMED, callback);
    },

    partiallyActivateAccessory: function (accessory, callback) {
        this.changeAccessoryState(accessory, JablotronConstants.JABLOTRON_PARTIALLY_ARMED, callback);
    },

    tryHandleError: function (error) {
        if (error?.['errno'] === -3001) return false;

        if (Array.isArray(error)) {
            for (let i = 0; i < error.length; i++) {
                if (error[i]['control-error'] === 'WRONG-CODE') {
                    this.service.log.error("Wrong pincode for: " + error[i]['component-id']);
                    return false;
                }
                if (error[i]['code'] === 'NOT-AUTHENTICATED') {
                    this.service.log.error(error[i]['message']);
                    return false;
                }
                if (error[i]['code'] === 'METHOD.NOT-SUPPORTED') {
                    return false;
                }
            }
        }
        return true;
    }
};

module.exports = Jablotron;
