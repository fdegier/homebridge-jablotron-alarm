'use strict';

const JablotronClient = require('./jablotron-client');

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

        var payload = {
            'login': this.service.getServiceConfig().getUsername(),
            'password': this.service.getServiceConfig().getPassword()
        };

        var self = this;
        this.client.doRequest('/login.json', payload, null, function (response) {
            var sessionId = response['session_id'];
            self.sessionId = sessionId;
            callback(sessionId);
        }, function () {
            callback(null);
        });
    },

    getAccessoryStates: function (callback) {
        var self = this;
        var serviceId = this.service.getId();
        var payload = {
            'data': '[{"filter_data":[{"data_type":"section"},{"data_type":"pgm"}],"service_type":"ja100","service_id":' + serviceId + ',"data_group":"serviceData","connect":true}]'
        };

        this.fetchSessionId(function (sessionId) {
            if (sessionId && sessionId != null) {
                self.client.doAuthenticatedRequest('/dataUpdate.json', payload, sessionId, function (response) {
                    var segments = response['data']['service_data'][0]['data'][0]['data']['segments'];
                    segments.forEach(function (segment) {
                        callback(segment['segment_key'], segment['segment_state']);
                    });

                    segments = response['data']['service_data'][0]['data'][1]['data']['segments'];
                    segments.forEach(function (segment) {
                        callback(segment['segment_key'], segment['segment_state']);
                    });

                    callback(null, null);
                }, function (error) {
                    if (self.tryHandleError(error)) {
                        self.getAccessoryStates(callback);
                    } else {
                        callback(null, null);
                    }
                });
            } else {
                callback(null, null);
            }
        });
    },

    changeAccessoryState: function (accessory, state, callback) {
        var keyboardOrSegmentKey = accessory.getSegmentKey();
        if (accessory.getKeyboardKey() != null) {
            keyboardOrSegmentKey = accessory.getKeyboardKey();
        }

        var payload = {
            'service': 'ja100',
            'serviceId': this.service.getId(),
            'segmentId': accessory.getSegmentId(),
            'segmentKey': keyboardOrSegmentKey,
            'expected_status': state,
            'control_code': this.service.getServiceConfig().getPincode(),
        }

        this.log("Switching section " + accessory.getSegmentKey() + " (using " + keyboardOrSegmentKey + ") to new state: " + state);

        var self = this;
        this.fetchSessionId(function (sessionId) {
            if (sessionId && sessionId != null) {
                self.client.doAuthenticatedRequest('/controlSegment.json', payload, sessionId, function (response) {
                    var stateChanged = response['segment_updates'].length != 0;
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
        this.changeAccessoryState(accessory, 'unset', callback);
    },

    activateAcccessory: function (accessory, callback) {
        this.changeAccessoryState(accessory, 'set', callback);
    },

    partiallyActivateAccessory: function (accessory, callback) {
        this.changeAccessoryState(accessory, 'partialSet', callback);
    },

    tryHandleError: function (error) {
        if (error.message == 'not_logged_in') {
            this.sessionId = null;
            return true;
        } else {
            this.log(error);
            return false;
        }
    }
}

module.exports = Jablotron;
