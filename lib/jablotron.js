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
            'password': this.service.getServiceConfig().getPassword(),
            'system': 'Android'
        };

        let self = this;
        this.client.doRequest('/login.json', payload, null, function (response) {
            console.log("JABLOTRON: Session ID: " + response['session_id']);    
            let sessionId = response['session_id'];
            self.sessionId = sessionId;
            callback(sessionId);
        }, function () {
            callback(null);
        });
    },

    getPayload: function (accessory) {
        console.log("JABLOTRON: getPayload");
        let filterData = '{"data_type":"section"}';
        if (accessory != null) {
            if (accessory.isPGM()) {
                filterData = '{"data_type":"pgm"}';
            } else if (accessory.isThermometer()) {
                filterData = '{"data_type":"thermometer"}';
            }
        } else {
            if (this.service.hasPGMAccessory()) {
                filterData += ',{"data_type":"pgm"}';
            }
            if (this.service.hasThermometerAccessory()) {
                filterData += ',{"data_type":"thermometer"}';
            }
        }

        return {
            'data': '[{"filter_data":[' + filterData + '],"service_type":"' + this.service.getServiceConfig().getServiceType() + '","service_id":' + this.service.getId() + ',"data_group":"serviceData","connect":true, "system":"Android"}]'
        };
    },

    parseResponseData: function (response) {
        let data = response['data'];
        if (JablotronConstants.isValidVariable(data)) {
            data = data['states'];
            if (JablotronConstants.isValidVariable(data) && Array.isArray(data)) {
                return data;
            }
        }

        this.service.log('WARN: Unexpected response: ' + JSON.stringify(response, null, 2));
        return null;
    },

    getAccessoryState: function (accessory, callback) {
        console.log("JABLOTRON: getAccessoryState");
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
        console.log("JABLOTRON: getAccessoryStates");
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
                    // self.debug("All available Programmable gates: " + JSON.stringify(responseData, null, 2));
                    responseData.forEach(function (programmableGate) {
                        callback(programmableGate['cloud-component-id'], programmableGate['state']);
                    });
                }, function (error) {
                    if (self.tryHandleError(error)) {
                        self.getAccessoryStates(callback);
                    } else {
                        console.log("JABLOTRON: Programmable gates error");
                        callback(null, null, null);
                    }
                });

                // Get Sections
                self.client.doAuthenticatedRequest('/' + "JA100" + '/sectionsGet.json', payload, sessionId, function (response) {
                    let responseData = self.parseResponseData(response);
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
                        console.log("JABLOTRON: getSections error");
                        callback(null, null, null);
                    }
                });

                // Get thermo devices
                self.client.doAuthenticatedRequest('/' + "JA100" + '/thermoDevicesGet.json', payload, sessionId, function (response) {
                    let responseData = self.parseResponseData(response);
                    console.log("JABLOTRON: All available thermo devices: " + JSON.stringify(responseData, null, 2));
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
                        console.log("JABLOTRON: getThermoDevices error");
                        callback(null, null, null);
                    }
                });
            } else {
                callback(null, null, null);
            }
        });
    },

    changeAccessoryState: function (accessory, state, callback) {
        // If the accessory is not a section we need to update the state from ARM to ON and DISARM to OFF
        let action = 'CONTROL-SECTION';
        if (!accessory.isSection()) {
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
        
        let segmentId = accessory.getSegmentId();

        let payload = {
            'service-id': this.service.getId(),
            'authorization': {
                'authorization-code': this.service.getServiceConfig().getPincode()
            },
            'control-components': [
                {
                    'actions': {
                        'action': action,
                        'value': state
                    },
                    'component-id': segmentId

                },
            ]
        };
        console.log("JABLOTRON: Payload: " + JSON.stringify(payload, null, 2));

        this.service.log("Switching section " + segmentId + " to new state: " + state);

        let self = this;
        this.fetchSessionId(function (sessionId) {
            if (sessionId) {
                self.client.doAuthenticatedRequest('/controlComponent.json', payload, sessionId, function (response) {
                    // console.log(response)
                    // console.log("States: " + JSON.stringify(response['data']['states']))
                    // response['data']['states'] looks like this:
                    // [
                    //     { 'component-id': 'SEC-331790683', state: 'DISARM' },
                    //     { 'component-id': 'SEC-331790703', state: 'DISARM' },
                    //     { 'component-id': 'SEC-331796073', state: 'DISARM' }
                    //   ]
                    // We need to find the component-id that matches the one we're looking for and check if the state has changed
                    let element_index = response['data']['states'].findIndex(function (element) {
                        return element['component-id'] === accessory.getSegmentId();
                    });
                    // console.log("Element index: " + element_index)
                    
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
        console.log("JABLOTRON: deactivateAccessory");
        this.changeAccessoryState(accessory, JablotronConstants.JABLOTRON_DISARMED, callback);
    },

    activateAcccessory: function (accessory, callback) {
        console.log("JABLOTRON: activateAcccessory");
        this.changeAccessoryState(accessory, JablotronConstants.JABLOTRON_ARMED, callback);
    },

    partiallyActivateAccessory: function (accessory, callback) {
        console.log("JABLOTRON: partiallyActivateAccessory");
        this.changeAccessoryState(accessory, JablotronConstants.JABLOTRON_PARTIALLY_ARMED, callback);
    },

    tryHandleError: function (error) {
        for (let i = 0; i < error.length; i++) {
            if (error[i]['control-error'] === 'WRONG-CODE') {
                this.service.log.error("ERROR: Unable to perform action, wrong pincode for: " + error[i]['component-id']);
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
