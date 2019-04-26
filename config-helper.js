'use strict';

const JablotronClient = require('./lib/jablotron-client');

function JablotronConfigHelper(username, password, log, debug) {
    this.username = username;
    this.password = password;
    this.client = new JablotronClient(log);
    this.sessionId = null;
    this.log = log;
    this.debug = debug;
}

JablotronConfigHelper.prototype = {

    fetchSessionId: function (callback) {
        let payload = {
            'login': this.username,
            'password': this.password,
            'system': 'Android'
        };

        let self = this;
        this.client.doRequest('/login.json', payload, null, function (response) {
            let sessionId = response['session_id'];
            self.sessionId = sessionId;
            callback(sessionId);
        });
    },

    fetchServices: function (callback) {
        let payload = {'list_type': 'extended'};
        let self = this;

        this.fetchSessionId(function (sessionId) {
            self.client.doAuthenticatedRequest('/getServiceList.json', payload, sessionId, function (response) {
                let services = response['services'];
                for (let i = 0; i < services.length; i++) {
                    let serviceId = services[i]['id'];
                    callback(serviceId);
                }
            }, function (error) {
                console.log(error);
            });
        })
    },

    createAccessory: function (segment, keyboardKey) {
        let result = {};
        result.name = segment['segment_name'];
        result.segment_id = segment['segment_id'];
        result.segment_key = segment['segment_key'];
        if (keyboardKey && keyboardKey != null) {
            result.keyboard_key = keyboardKey;
        }
        return result;
    },

    isSegmentUsable: function (segment) {
        if (!segment['segment_is_controllable']) {
            return false;
        }

        if (segment['segment_status'] != 'ready') {
            return false;
        }

        return true;
    },

    getAccessories: function () {
        let self = this;
        this.fetchServices(function (serviceId) {
            let payload = {
                'data': '[{"filter_data":[{"data_type":"section"},{"data_type":"keyboard"},{"data_type":"pgm"}],"service_type":"ja100","service_id":' + serviceId + ',"data_group":"serviceData","connect":true,"system":"Android"}]'
            };

            self.client.doAuthenticatedRequest('/dataUpdate.json', payload, self.sessionId, function (response) {
                let service = {};
                service.id = serviceId;
                service.name = "Home";
                service.username = self.username;
                service.password = self.password;
                service.pincode = "Enter Your pincode";
                service.sections = [];
                service.switches = [];
                service.outlets = [];

                if (self.debug) {
                    self.log("");
                    self.log("================================");
                    self.log("=== Debug for service " + serviceId + " ===");
                    self.log("================================");
                    self.log(JSON.stringify(response, null, 4));
                    self.log("================================");
                    self.log("");
                }

                let keyboards = response['data']['service_data'][0]['data'][2]['data']['segments'];
                let keyboardMap = {};
                keyboards.forEach(function (keyboard) {
                    if (self.isSegmentUsable(keyboard) && keyboard['segment_type'] == "keyboard" && keyboard['segment_subtype'] == 'section' && keyboard['segment_next_set_state'] == 'partialSet') {
                        keyboardMap[keyboard['segment_id']] = keyboard['segment_key'];
                    }
                });

                let segments = response['data']['service_data'][0]['data'][0]['data']['segments'];
                segments.forEach(function (segment) {
                    if (self.isSegmentUsable(segment)) {
                        let accessory = self.createAccessory(segment, keyboardMap[segment['segment_id']]);
                        service.sections.push(accessory);
                    }
                });

                segments = response['data']['service_data'][0]['data'][2]['data']['segments'];
                segments.forEach(function (segment) {
                    if (self.isSegmentUsable(segment)) {
                        let accessory = self.createAccessory(segment, null);
                        service.switches.push(accessory);
                    }
                });

                self.log("SERVICE => " + JSON.stringify(service, null, 4));
                self.log("");
            });
        });
    },
}

if (process.argv.length < 4) {
    console.log("Required arguments are missing!!!");
} else {
    let username = process.argv[2];
    let password = process.argv[3];
    let debug = false;

    for (let i = 4; i < process.argv.length; i++) {
        if (process.argv[i] == '-d') {
            debug = true;
        }
    }

    let helper = new JablotronConfigHelper(username, password, console.log, debug);
    helper.getAccessories();
}
