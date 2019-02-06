'use strict';

const JablotronClient = require('./lib/jablotron-client');

function JablotronConfigHelper(username, password, log) {
    this.username = username;
    this.password = password;
    this.client = new JablotronClient(log);
    this.sessionId = null;
}

JablotronConfigHelper.prototype = {

    fetchSessionId: function (callback) {
        var payload = {
            'login': username,
            'password': password
        };

        var self = this;
        this.client.doRequest('/login.json', payload, null, function (response) {
            var sessionId = response['session_id'];
            self.sessionId = sessionId;
            callback(sessionId);
        });
    },

    fetchServices: function (callback) {
        var payload = {'list_type': 'extended'};
        var self = this;

        this.fetchSessionId(function (sessionId) {
            self.client.doAuthenticatedRequest('/getServiceList.json', payload, sessionId, function (response) {
                var services = response['services'];
                for (var i = 0; i < services.length; i++) {
                    var serviceId = services[i]['id'];
                    callback(serviceId);
                }
            }, function (error) {
                console.log(error);
            });
        })
    },

    printAccessory: function(type, segment, keyboardKey) {
        console.log(type + " => ");
        console.log("   name = " + segment['segment_name']);
        console.log("   segment_id = " + segment['segment_id']);
        console.log("   segment_key = " + segment['segment_key']);
        if (keyboardKey != null) {
            console.log("   keyboard_key = " + keyboardKey);
        }
        console.log("");
    },

    getAccessories: function () {
        var self = this;
        var config = new Object();
        config.platform = "Jablotron";
        config.name = "Jablotron";
        config.services = [];

        this.fetchServices(function(serviceId) {
            var service = new Object();
            service.id = serviceId;
            config.services.push(service);

            console.log("--------------------");
            console.log("Service: ID = " + serviceId);
            console.log("--------------------");

            var payload = {
                'data': '[{"filter_data":[{"data_type":"section"},{"data_type":"keyboard"},{"data_type":"pgm"}],"service_type":"ja100","service_id":' + serviceId + ',"data_group":"serviceData","connect":true}]'
            };

            self.client.doAuthenticatedRequest('/dataUpdate.json', payload, self.sessionId, function(response) {
                var keyboards = response['data']['service_data'][0]['data'][1]['data']['segments'];
                var keyboardMap = {};
                keyboards.forEach((keyboard) => {
                    if (keyboard['segment_type'] == "keyboard") {
                        keyboardMap[keyboard['segment_id']] = keyboard['segment_key'];
                    }
                });

                var segments = response['data']['service_data'][0]['data'][0]['data']['segments'];
                segments.forEach((segment) => {
                    self.printAccessory("Section", segment, keyboardMap[segment['segment_id']]);
                });

                segments = response['data']['service_data'][0]['data'][2]['data']['segments'];
                segments.forEach((segment) => {
                    self.printAccessory("PGM", segment, null);
                });
            });
        });
    },
}

if (process.argv.length < 4) {
    console.log("Required arguments are missing!!!");
} else {
    var username = process.argv[2];
    var password = process.argv[3];

    var helper = new JablotronConfigHelper(username, password, console.log);
    helper.getAccessories();
}
