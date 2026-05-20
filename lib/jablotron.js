// noinspection JSUnresolvedFunction,NpmUsedModulesInstalled,JSUnresolvedVariable

'use strict';

const JablotronClient = require('./jablotron-client');
const JablotronConstants = require('./const');

function Jablotron(service) {
    this.service = service;
    this.client = new JablotronClient(service.getLog());
    this.sessionId = null;
    this.apiType = service.getServiceConfig().getServiceType().toUpperCase();
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
                    if (JablotronConstants.isValidVariable(state['temperature'])) {
                        let index = states.findIndex(function (element) {
                            return element['cloud-component-id'] === state['object-device-id'];
                        });
                        if (index >= 0) {
                            continue;
                        } else {
                            states.push({
                                "cloud-component-id": state['object-device-id'],
                                "state": state['temperature']
                            });
                        }
                    } else {
                        let index = states.findIndex(function (element) {
                            return element['cloud-component-id'] === state['cloud-component-id'];
                        });
                        if (index >= 0) {
                            continue;
                        } else {
                            states.push(state);
                        }
                    }
                }
                return states;
            }
        }

        this.service.log('WARN: Unexpected response: ' + JSON.stringify(response, null, 2));
        return null;
    },

    matchesSegmentId: function (element, segmentId) {
        return element['cloud-component-id'] === segmentId
            || element['component-id'] === segmentId
            || element['object-device-id'] === segmentId;
    },

    resolveAccessoryComponentIds: function (accessories, callback) {
        let self = this;
        let payload = {
            "connect-device": true,
            "list-type": "FULL",
            "service-id": this.service.getId(),
            "service-states": true
        };

        this.fetchSessionId(function (sessionId) {
            if (!sessionId) {
                callback();
                return;
            }

            self.client.doAuthenticatedRequest('/' + self.apiType + '/sectionsGet.json', payload, sessionId, function (response) {
                let sections = (response['data'] && response['data']['sections']) || [];
                let states = self.parseResponseData(response) || [];

                for (let i = 0; i < accessories.length; i++) {
                    let accessory = accessories[i];
                    if (!accessory.isSection()) {
                        continue;
                    }

                    let configuredId = accessory.getSegmentId();
                    let resolvedId = null;

                    for (let j = 0; j < sections.length; j++) {
                        let section = sections[j];
                        let sectionName = (section['name'] || '').toLowerCase();
                        let accessoryName = (accessory.name || '').toLowerCase();
                        if (sectionName === accessoryName
                            || section['cloud-component-id'] === configuredId) {
                            resolvedId = section['cloud-component-id'];
                            break;
                        }
                    }

                    if (resolvedId == null) {
                        for (let k = 0; k < states.length; k++) {
                            let state = states[k];
                            if (self.matchesSegmentId(state, configuredId)) {
                                resolvedId = state['cloud-component-id'];
                                break;
                            }
                        }
                    }

                    if (resolvedId != null && resolvedId !== configuredId) {
                        accessory.addAlternateSegmentId(resolvedId);
                        self.service.log("Linked section \"" + accessory.name + "\" status id "
                            + resolvedId + " (control uses " + configuredId + ")");
                    } else if (resolvedId == null) {
                        let available = sections.map(function (s) {
                            return (s['name'] || '?') + '=' + (s['cloud-component-id'] || '?');
                        }).join(', ');
                        self.service.log.warn("Could not resolve section \"" + accessory.name
                            + "\" (segment_id=" + configuredId + "). Available sections: "
                            + (available || 'none') + ". Update segment_id in config.json.");
                    }
                }

                callback();
            }, function (error) {
                self.tryHandleError(error);
                callback();
            });
        });
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
                self.client.doAuthenticatedRequest('/' + self.apiType + '/sectionsGet.json', payload, sessionId, function (response) {
                    let responseData = self.parseResponseData(response);
                    if (responseData != null && responseData.length > 0) {
                        responseData.forEach(function (segment) {
                            if (self.matchesSegmentId(segment, accessory.getSegmentId())) {
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
                self.client.doAuthenticatedRequest('/' + self.apiType + '/programmableGatesGet.json', payload, sessionId, function (response) {
                    let responseData = self.parseResponseData(response);
                    self.service.debugPayload("All available Programmable gates: " + JSON.stringify(response['data']['programmableGates'], null, 2));
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
                self.client.doAuthenticatedRequest('/' + self.apiType + '/sectionsGet.json', payload, sessionId, function (response) {
                    let responseData = self.parseResponseData(response);
                    self.service.debugPayload("All available Sections: " + JSON.stringify(response['data']['sections'], null, 2));
                    if (responseData != null && responseData.length > 0) {
                        responseData.forEach(function (segment) {
                            let ids = [
                                segment['cloud-component-id'],
                                segment['object-device-id'],
                                segment['component-id']
                            ].filter(function (id) { return id != null; });
                            let uniqueIds = ids.filter(function (id, index) { return ids.indexOf(id) === index; });
                            uniqueIds.forEach(function (segmentId) {
                                callback(segmentId, segment['state']);
                            });
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
                self.client.doAuthenticatedRequest('/' + self.apiType + '/thermoDevicesGet.json', payload, sessionId, function (response) {
                    let responseData = self.parseResponseData(response);
                    self.service.debugPayload("JABLOTRON: All available thermo devices: " + JSON.stringify(response["data"], null, 2));
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
            return;
        }
        let self = this;
        let payload = {
            "list-type": "EXTENDED",
            "visibility": "DEFAULT"
        }

        this.fetchSessionId(function (sessionId) {
            if (sessionId) {
                self.client.doAuthenticatedRequest('/' + self.apiType + '/serviceListGet.json', payload, sessionId, function (response) {
                    self.service.debugPayload("All available Services: " + JSON.stringify(response['data']['services'], null, 2));
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
                    let segmentId = accessory.getSegmentId();
                    let states = response['data'] && response['data']['states'];

                    if (states && Array.isArray(states)) {
                        let element_index = states.findIndex(function (element) {
                            return self.matchesSegmentId(element, segmentId);
                        });
                        self.service.debug('Control response state match for ' + segmentId + ': '
                            + (element_index >= 0 ? "Yes" : "No"));
                    } else {
                        self.service.debug('Control response has no states array for ' + segmentId
                            + ' (request accepted)');
                    }

                    self.service.log("Control request accepted for " + segmentId);
                    callback(true);
                }, function (error) {
                    if (self.tryHandleError(error)) {
                        self.changeAccessoryState(accessory, state, callback);
                    } else {
                        callback(false);
                    }
                });
            } else {
                self.service.log.error("ERROR: No Jablotron session — cannot control " + segmentId);
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
        if (error == null) {
            return false;
        }
        if (error['errno'] === -3001) {
            return false;
        }
        if (Array.isArray(error)) {
            for (let i = 0; i < error.length; i++) {
                if (error[i]['control-error'] === 'WRONG-CODE') {
                    this.service.log.error("ERROR: Wrong pincode for component: " + error[i]['component-id']);
                    return false;
                } else if (error[i]['code'] === 'NOT-AUTHENTICATED') {
                    this.service.log.error("ERROR: " + error[i]['message']);
                    return true;
                } else if (error[i]['code'] === 'METHOD.NOT-SUPPORTED') {
                    this.service.log.error("ERROR: Method not supported — " + JSON.stringify(error[i]));
                    return false;
                }
            }
            this.service.log.error("ERROR: Jablotron control error: " + JSON.stringify(error));
            return false;
        }
        this.service.log.error("ERROR: " + JSON.stringify(error));
        return false;
    }
};

module.exports = Jablotron;
