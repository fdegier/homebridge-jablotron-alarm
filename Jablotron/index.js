const JablotronClient = require('./jablotronClient.js');

module.exports = Jablotron;

function Jablotron(log, config, jablotronClient) {
    this.log = log;
    this.jablotronClient = jablotronClient;
    this.username = config['username'];
    this.password = config['password'];
    this.pincode = config['pincode'];
    this.service_id = config['service_id'];
    this.segment = config['segment'];
    
    this.api_hostname = 'api.jablonet.net';

    this.sessionId = null;
}

Jablotron.prototype = {

    fetchSessionId: function(callback) {
        if (this.sessionId != null) {
            this.log('Using cached sessionId.');
            return callback(this.sessionId);
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
        var payload = {
            'data': '[{"filter_data":[{"data_type":"section"}],"service_type":"ja100","service_id":' + this.service_id + ',"data_group":"serviceData","connect":true}]'
        };

        var self = this;
        this.fetchSessionId(function(sessionId) {
            try { 
                self.jablotronClient.doAuthenticatedRequest('/dataUpdate.json', payload, sessionId, function(response) {
                    var segments = response['data']['service_data'][0]['data'][0]['data']['segments'];
                    var segment_status = {};

                    segments.forEach((segment, index) => {
                        segment_status[segment['segment_key']] = segment['segment_state'];
                    });

                    callback(segment_status[self.segment] != "unset");
                });
            } catch (error) {
                if (error.message == 'not_logged_in') {
                    this.log('Invalidating sessionId.');
                    self.sessionId = null;
                    self.isAlarmActive(callback);
                }            
            }
        })
    },

    switchAlarmState: function(state, callback) {
        var payload = {
            'service': 'ja100',
            'serviceId': this.service_id,
            'segmentId': 'STATE_1',
            'segmentKey': this.segment,
            'expected_status': state,
            'control_code': this.pincode,
        }

        var self = this;
        this.fetchSessionId(function(sessionId) {
            try
            {
                self.jablotronClient.doAuthenticatedRequest('/controlSegment.json', payload, sessionId, function(response) {
                    var isStateChanged = response['segment_updates'].length != 0;
                    self.log('Was alarm state changed?' + isStateChanged);
                    callback(isStateChanged);
                });
            } catch (error) {
                if (error.message == 'not_logged_in') {
                    this.log('Invalidating sessionId.');
                    self.sessionId = null;
                    self.switchAlarmState(callback);
                }            
            }
        });
    },

    deactivateAlarm: function(callback) {
        this.switchAlarmState('unset', callback);
    },

    activateAlarm: function(callback) {
        this.switchAlarmState('set', callback);
    }

}

/*

// Code for local testing without HomeBridge.

var config = {
    'username': 'xxxxx',
    'password': 'xxxxx',
    'pincode': 'xxxx',
    'service_id': 'xxxxx',
    'segment': 'xxxxx',
};

var j = new Jablotron(console.log, config, new JablotronClient(console.log));


j.isAlarmActive(function(isAlarmActive){
    console.log(isAlarmActive);
})

j.deactivateAlarm(function(isStateChanged){
    console.log(isStateChanged);
})*/