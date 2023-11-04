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

        let payload = {
            'login': this.service.getServiceConfig().getUsername(),
            'password': this.service.getServiceConfig().getPassword()
        };

        let self = this;
        this.client.doRequest('/userAuthorize.json', payload, null, true, function (response) {
            let sessionId = response
            self.sessionId = sessionId;
            callback(sessionId);
        }, function (error) {
            self.tryHandleError(error);
            callback(null);
        });
    },

    parseResponseData: function (response) {
        let data = response['data'];
        let states = []
        if (JablotronConstants.isValidVariable(data)) {
            let serviceEvents = data['service-states']['events'];
            if (JablotronConstants.isValidVariable(serviceEvents) && Array.isArray(serviceEvents)) {
                for (let i = 0; i < serviceEvents.length; i++) {
                    let event = serviceEvents[i];
                    if (event['type'] === 'ALARM') {
                        let sectionName = event['message'].split(", Section ")[1]
                        if ( data['sections'] != undefined ) {
                            let sectionId = data['sections'].find(function (element) {
                                return element['name'] === sectionName;
                            });
                            this.service.log("ALARM IN SECTION: " + sectionId['cloud-component-id'])
                            states.push({
                                "cloud-component-id": sectionId['cloud-component-id'],
                                "state": JablotronConstants.JABLOTRON_TRIGGERED
                            });
                        }
                    } else {
                        this.service.log("WARNING: " + event['message']);
                    }
                }
            }

            if (JablotronConstants.isValidVariable(data['states']) && Array.isArray(data['states'])) {
                for (let i = 0; i < data['states'].length; i++) {
                    let state = data['states'][i];
                    let index = states.findIndex(function (element) {
                        return element['cloud-component-id'] === state['cloud-component-id'];
                    });
                    if (index >= 0) {
                        continue;
                    } else {
                        states.push(state);
                    }
                }
                return states;
            }
        }

        this.service.log('WARN: Unexpected response: ' + JSON.stringify(response, null, 2));
        return null;
    },

    getAccessoryState: function (accessory, callback) {
        let self = this;
        let payload = {
            "connect-device": true,
            "list-type": "FULL",
            "service-id": this.service.getId(),
            "service-states": true
        }

        this.fetchSessionId(function (sessionId) {
            if (sessionId) {
                self.client.doAuthenticatedRequest('/' + this.service_type + '/sectionsGet.json', payload, sessionId, function (response) {
                    let responseData = self.parseResponseData(response);
                    if (responseData != null && responseData.length > 0) {
                        let segments = responseData['states'];
                        segments.forEach(function (segment) {
                            let segmentId = segment['cloud-component-id'];

                            if (segmentId === accessory.getSegmentId()) {
                                callback(segment['state']);
                            }
                        });
                    }
                }, function (error) {
                    if (self.tryHandleError(error)) {
                        self.getAccessoryState(accessory, callback);
                    }
                });
            }
        });
    },

    getAccessoryStates: function (callback) {
        let self = this;
        let payload = {
            "connect-device": true,
            "list-type": "FULL",
            "service-id": this.service.getId(),
            "service-states": true
        }

        this.fetchSessionId(function (sessionId) {
            if (sessionId) {
                // Get Programmable gates
                self.client.doAuthenticatedRequest('/' + "JA100" + '/programmableGatesGet.json', payload, sessionId, function (response) {
                    let responseData = self.parseResponseData(response);
                    self.service.debug("All available Programmable gates: " + JSON.stringify(response['data']['programmableGates'], null, 2));
                    responseData.forEach(function (programmableGate) {
                        callback(programmableGate['cloud-component-id'], programmableGate['state']);
                    });
                }, function (error) {
                    if (self.tryHandleError(error)) {
                        self.getAccessoryStates(callback);
                    } else {
                        callback(null, null, null);
                    }
                });

                // Get Sections
                self.client.doAuthenticatedRequest('/' + "JA100" + '/sectionsGet.json', payload, sessionId, function (response) {
                    let responseData = self.parseResponseData(response);
                    self.service.debug("All available Sections: " + JSON.stringify(response['data']['sections'], null, 2));
                    if (responseData != null && responseData.length > 0) {
                        responseData.forEach(function (segment) {
                            callback(segment['cloud-component-id'], segment['state']);
                        });
                    }
                    callback(null, null, null);
                }, function (error) {
                    if (self.tryHandleError(error)) {
                        self.getAccessoryStates(callback);
                    } else {
                        callback(null, null, null);
                    }
                });

                // Get thermo devices
                self.client.doAuthenticatedRequest('/' + "JA100" + '/thermoDevicesGet.json', payload, sessionId, function (response) {
                    let responseData = self.parseResponseData(response);
                    self.service.debug("JABLOTRON: All available thermo devices: " + JSON.stringify(response["data"], null, 2));
                    if (responseData != null && responseData.length > 0) {
                        responseData.forEach(function (thermoDevice) {
                            callback(thermoDevice['cloud-component-id'], thermoDevice['state']);
                        });
                    }

                    callback(null, null, null);
                }, function (error) {
                    if (self.tryHandleError(error)) {
                        self.getAccessoryStates(callback);
                    } else {
                        callback(null, null, null);
                    }
                });
            } else {
                callback(null, null, null);
            }
        });
    },

    getServices: function () {
        // Function to display all available services at startup
        if (this.debug === false) {
            console.log("Debug not enabled")
            return;
        }
        let self = this;
        let payload = {
            "list-type": "EXTENDED",
            "visibility": "DEFAULT"
        }

        this.fetchSessionId(function (sessionId) {
            if (sessionId) {
                self.client.doAuthenticatedRequest('/' + "JA100" + '/serviceListGet.json', payload, sessionId, function (response) {
                    self.service.debug("All available Services: " + JSON.stringify(response['data']['services'], null, 2));
                }, function (error) {

                });
            }
        }
        );
    },

    changeAccessoryState: function (accessory, state, callback) {
        let segmentId = accessory.getSegmentId();

        // If the accessory is not a section we need to update the state from ARM to ON and DISARM to OFF
        let action = 'CONTROL-SECTION';
        if (accessory.isPGM() && !segmentId.startsWith('SEC-') ) {
            action = 'CONTROL-PG';
            if (state === JablotronConstants.JABLOTRON_ARMED) {
                state = JablotronConstants.ACCESSORY_ARMED;
            }
            else if (state === JablotronConstants.JABLOTRON_DISARMED) {
                state = JablotronConstants.ACCESSORY_DISARMED;
            } else {
                this.service.log("WARN: Unexpected state: " + state);
                callback(false);
                return;
            }
        }
        
        let payload = {
            'service-id': this.service.getId(),
            'authorization': {
                'authorization-code': this.service.getServiceConfig().getPincode()
            },
            'control-components': [
                {
                    'actions': {
                        'action': action,
                        'value': state,
                        'force': true,
                    },
                    'component-id': segmentId

                },
            ]
        };

        this.service.log("Switching section " + segmentId + " to new state: " + state);

        let self = this;
        this.fetchSessionId(function (sessionId) {
            if (sessionId) {
                self.client.doAuthenticatedRequest('/controlComponent.json', payload, sessionId, function (response) {
                    let element_index = response['data']['states'].findIndex(function (element) {
                        return element['component-id'] === accessory.getSegmentId();
                    });
                    
                    let stateChanged = false;
                    if (element_index >= 0) {
                        stateChanged = true;
                    }

                    self.service.debug('Was accessory state changed? ' + (stateChanged ? "Yes" : "No"));
                    callback(stateChanged);
                }, function (error) {
                    if (self.tryHandleError(error)) {
                        self.changeAccessoryState(accessory, state, callback);
                    } else {
                        callback(false);
                    }
                });
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
        this.service.log("JABLOTRON: tryHandleError: " + JSON.stringify(error));
        for (let i = 0; i < error.length; i++) {
            if (error[i]['control-error'] === 'WRONG-CODE') {
                this.service.log.error("ERROR: Unable to perform action, wrong pincode for: " + error[i]['component-id']);
                return false;
            } else if (error[i]['code'] === 'NOT-AUTHENTICATED') {
                this.service.log.error("ERROR: " + error[i]['message']);
                return false;
            } else if (error[i]['code'] === 'METHOD.NOT-SUPPORTED') {
                this.service.log.error("ERROR: " + error[i]['message']);
                return false;
            }
        }
        // if (error['message'] === 'not_logged_in') {
        //     this.sessionId = null;
        //     return true;
        // } else if (error['code'] === 'USER.NO-PERMISSION') {
        //     this.service.log(error['message']);
        //     return false;
        // } else {
        //     this.service.log(error['message']);
        //     return false;
        // }
    }
};

module.exports = Jablotron;
