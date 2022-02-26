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
            let sessionId = response['session_id'];
            self.sessionId = sessionId;
            callback(sessionId);
        }, function () {
            callback(null);
        });
    },

    getPayload: function (accessory) {
        let filterData = '{"data_type":"section"},{"data_type":"pgm"},{"data_type":"thermometer"}';

        if (accessory != null) {
            if (accessory.isPGM()) {
                filterData = '{"data_type":"pgm"}';
            } else if (accessory.isThermometer()) {
                filterData = '{"data_type":"thermometer"}';
            }
             else {
                filterData = '{"data_type":"section"}';
            }
        }

        let payload = {
            'data': '[{"filter_data":[' + filterData + '],"service_type":"' + this.service.getServiceConfig().getServiceType() + '","service_id":' + this.service.getId() + ',"data_group":"serviceData","connect":true, "system":"Android"}]'
        };
        return payload;
    },

    parseResponseData: function (response) {
        let data = response['data'];
        if (data != undefined && data != null) {
            data = data['service_data'];
            if (Array.isArray(data) && data.length > 0) {
                if (Array.isArray(data[0]['data']) && data[0]['data'].length > 0) {
                    return data[0];
                }
            }
        }

        this.service.log('WARN: Unexpected response: ' + JSON.stringify(response, null, 2));
        return null;
    },

    getAccessoryState: function (accessory, callback) {
        let self = this;
        let payload = this.getPayload(accessory);

        this.fetchSessionId(function (sessionId) {
            if (sessionId && sessionId != null) {
                self.client.doAuthenticatedRequest('/dataUpdate.json', payload, sessionId, function (response) {
                    let responseData = self.parseResponseData(response);
                    if (responseData["data"] != null) {
                        if (responseData["service_events_type"] == "tamper" || responseData["service_events_type"] == "alarm") {
                            callback("triggered")
                        }
                        let segments = responseData["data"][0]['data']['segments'];
                        segments.forEach(function (segment) {
                            let segmentKey = segment['segment_key'];

                            if (segmentKey == accessory.getSegmentKey()) {
                                callback(segment['segment_state'], segment['segment_informations']);
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
        let payload = this.getPayload(null);

        this.fetchSessionId(function (sessionId) {
            if (sessionId && sessionId != null) {
                self.client.doAuthenticatedRequest('/dataUpdate.json', payload, sessionId, function (response) {
                    let responseData = self.parseResponseData(response);
                    if (responseData["data"] != null) {
                        let alarm_service_event = [];
                        if (responseData["service_events_type"] == "tamper" || responseData["service_events_type"] == "alarm") {
                            alarm_service_event =  responseData["service_events"];
                        }
                        for (let i = 0; i < responseData["data"].length; i++) {
                            let segments = responseData["data"][0]['data']['segments'];
                            segments.forEach(function (segment) {
                                if (alarm_service_event.join().includes(segment['segment_name'])) {
                                    callback(segment['segment_key'], "triggered", "");
                                };
                                callback(segment['segment_key'], segment['segment_state'], segment['segment_informations']);
                            });
                        }
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

    changeAccessoryState: function (accessory, state, callback) {
        let keyboardOrSegmentKey = accessory.getSegmentKey();
        if (JablotronConstants.isJablotronPartiallyArmed(state) && accessory.isPartiallyArmedAvailable()) {
            keyboardOrSegmentKey = accessory.getKeyboardKey();
        }

        let payload = {
            'service': this.service.getServiceConfig().getServiceType(),
            'serviceId': this.service.getId(),
            'segmentId': accessory.getSegmentId(),
            'segmentKey': keyboardOrSegmentKey,
            'expected_status': state,
            'control_code': this.service.getServiceConfig().getPincode(),
            'system': 'Android'
        };

        this.service.log("Switching section " + accessory.getSegmentKey() + " (using " + keyboardOrSegmentKey + ") to new state: " + state);

        let self = this;
        this.fetchSessionId(function (sessionId) {
            if (sessionId && sessionId != null) {
                self.client.doAuthenticatedRequest('/controlSegment.json', payload, sessionId, function (response) {
                    let stateChanged = response['segment_updates'].length != 0;
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
        if (error.message == 'not_logged_in') {
            this.sessionId = null;
            return true;
        } else if (error.message == 'Operation failed') {
            this.service.log("ERROR: USER DOES NOT HAVE SUFFICIENT PERMISSIONS");
            return false;
        } else {
            this.service.log(error);
            return false;
        }
    }
};

module.exports = Jablotron;
