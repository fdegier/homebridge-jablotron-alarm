const JablotronClient = require('./jablotronClient.js');

module.exports = Jablotron;

function Jablotron(log, config, jablotronClient) {
    this.log = log;
    this.jablotronClient = jablotronClient;
    this.username = config['username'];
    this.password = config['password'];
    this.pincode = config['pincode'];
    this.serviceId = config['service_id'];
    this.segment = config['segment'];
    
    this.api_hostname = 'api.jablonet.net';

    this.sessionId = null;
}

Jablotron.prototype = {

    fetchServiceId: function(callback) {
        if (this.serviceId != null) {
            this.log('Using cached serviceId.');
            callback(this.serviceId);
            return;
        }

        var payload = { 'list_type': 'extended' };

        this.log('Obtaining serviceId.');
        var self = this;
        this.fetchSessionId(function(sessionId) {
            self.jablotronClient.doAuthenticatedRequest('/getServiceList.json', payload, sessionId, function(response) {
                var serviceId = response['services'][0]['id'];
                self.serviceId = serviceId;
                callback(serviceId);
            }, function(error){
                if (self.tryHandleError(error)){
                    self.fetchSessionId(callback);
                }            
            });
        })
    },

    fetchSessionId: function(callback) {
        if (this.sessionId != null) {
            this.log('Using cached sessionId.');
            callback(this.sessionId);
            return;
        }
        
        var payload = {
            'login': this.username,
            'password': this.password
        };

        this.log('Obtaining sessionId.');
        var self = this;
        this.jablotronClient.doRequest('/login.json', payload, null, function(response) {
            var sessionId = response['session_id'];
            self.sessionId = sessionId;
            callback(sessionId);
        });
    },

    isAlarmActive: function(callback) {
        var self = this;
        this.fetchServiceId(function(serviceId) {
            var payload = {
                'data': '[{"filter_data":[{"data_type":"section"}],"service_type":"ja100","service_id":' + serviceId + ',"data_group":"serviceData","connect":true}]'
            };

            self.fetchSessionId(function(sessionId) {
                self.jablotronClient.doAuthenticatedRequest('/dataUpdate.json', payload, sessionId, function(response) {
                    var segments = response['data']['service_data'][0]['data'][0]['data']['segments'];
                    var segment_status = {};

                    segments.forEach((segment, index) => {
                        segment_status[segment['segment_key']] = segment['segment_state'];
                    });

                    callback(segment_status[self.segment] != "unset");
                }, function(error){
                    if (self.tryHandleError(error)){
                        self.isAlarmActive(callback);
                    }            
                });
            });
        });
    },

    switchAlarmState: function(state, callback) {
        var self = this;
        this.fetchServiceId(function(serviceId) {
            var payload = {
                'service': 'ja100',
                'serviceId': serviceId,
                'segmentId': 'STATE_1',
                'segmentKey': self.segment,
                'expected_status': state,
                'control_code': self.pincode,
            }

            self.fetchSessionId(function(sessionId) {
                self.jablotronClient.doAuthenticatedRequest('/controlSegment.json', payload, sessionId, function(response) {
                    var isStateChanged = response['segment_updates'].length != 0;
                    self.log('Was alarm state changed? ' + isStateChanged);
                    callback(isStateChanged);
                }, function(error){
                    if (self.tryHandleError(error)){
                        self.switchAlarmState(callback);
                    }
                });
            });
        });
    },

    deactivateAlarm: function(callback) {
        this.switchAlarmState('unset', callback);
    },

    activateAlarm: function(callback) {
        this.switchAlarmState('set', callback);
    },

    tryHandleError: function(error){
        if (error.message == 'not_logged_in') {
            this.log('Invalidating sessionId.');
            this.sessionId = null;
            return true;
        }
        else {
            this.log('Cannot handle error:');
            this.log(error);
            return false;
        }
    }
}



// Code for local testing without HomeBridge.
/*
var config = {
    'username': 'xxxxx',
    'password': 'xxxxx',
    'pincode': 'xxxx',
    'service_id': 'xxxxx',
    'segment': 'xxxxx',
};

var j = new Jablotron(console.log, config, new JablotronClient(console.log));
*/
/*
j.fetchServiceId(function(isAlarmActive){
    console.log(isAlarmActive);
})*/

/*
j.isAlarmActive(function(isStateChanged){
    console.log(isStateChanged);
})
*/
/*
j.deactivateAlarm(function(result){
    console.log(result);
})*/