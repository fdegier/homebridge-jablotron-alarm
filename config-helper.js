'use strict';

const JablotronClient = require('./lib/jablotron-client');
const SECTIONS = 1
const PGS = 2
const THERMOMETERS = 4
const ALL_ACCESSORIES = SECTIONS | PGS | THERMOMETERS

function JablotronConfigHelper(username, password, service_type, log, debug) {
    this.username = username;
    this.password = password;
    this.service_type = service_type;
    this.client = new JablotronClient(log);
    this.sessionId = null;
    this.log = log;
    this.debug = debug;
    this.service = {};
    this.stepsCompleted = 0;
}

JablotronConfigHelper.prototype = {
    fetchSessionId: function (callback) {
        let payload = {
            'login': this.username,
            'password': this.password
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

    fetchServices: function (callback) {
        let self = this;
        let payload = {
            "list-type": "EXTENDED",
            "visibility": "DEFAULT"
        }

        this.fetchSessionId(function (sessionId) {
            self.client.doAuthenticatedRequest('/' + "JA100" + '/serviceListGet.json', payload, sessionId, function (response) {
                let services = response['data']['services'];
                for (let i = 0; i < services.length; i++) {
                    let serviceId = services[i]['service-id'];
                    callback(serviceId);
                }
            }, function (error) {
                console.log(error)
            });
        });
    },

    createAccessory: function (segment) {
        let result = {};
        result.name = segment['name'];

        if ('THERMOMETER' === segment['type']) {
            result.segment_id = segment['object-device-id'];
        } else {
            result.segment_id = segment['cloud-component-id'];
        }
        if (true === segment['partial-arm-enabled']) {
            result.partiallyArmedMode = 'Home'
        }
        return result;
    },

    isSectionEligible: function (segment) {
        if ('THERMOMETER' === segment['type']) {
            return true;
        }

        return segment['can-control'];
    },

    printConfig: function (currentStep) {
        this.stepsCompleted = this.stepsCompleted | currentStep;

        if (this.stepsCompleted === ALL_ACCESSORIES) {
            this.log("SERVICE => " + JSON.stringify(this.service, null, 4));
            this.log("");
        }
    },

    getAccessories: function () {
        let self = this;
        this.fetchServices(function (serviceId) {
            let payload = {
                "connect-device": true,
                "list-type": "FULL",
                "service-id": serviceId,
                "service-states": true
            }

            self.service.id = serviceId;
            self.service.name = "Home";
            self.service.username = self.username;
            self.service.password = self.password;
            self.service.pincode = "Enter Your pincode";
            self.service.service_type = self.service_type;
            self.service.sections = [];
            self.service.switches = [];
            self.service.outlets = [];
            self.service.thermometers = [];

            self.client.doAuthenticatedRequest('/' + "JA100" + '/sectionsGet.json', payload, self.sessionId, function (response) {
                if (self.debug === true) {
                    self.log("Available Sections: " + JSON.stringify(response, null, 4));
                }

                let sections = response['data']['sections'];
                sections.forEach(function (section) {
                    if (self.isSectionEligible(section)) {
                        let accessory = self.createAccessory(section);
                        self.service.sections.push(accessory);
                    }
                })

                self.printConfig(SECTIONS);
            }, function (error) {
                console.log(error)
            });

            self.client.doAuthenticatedRequest('/' + "JA100" + '/programmableGatesGet.json', payload, self.sessionId, function (response) {
                if (self.debug === true) {
                    self.log("Available PGs: " + JSON.stringify(response, null, 4));
                }

                let sections = response['data']['programmableGates'];
                sections.forEach(function (section) {
                    if (self.isSectionEligible(section)) {
                        let accessory = self.createAccessory(section);
                        self.service.switches.push(accessory);
                    }
                })

                self.printConfig(PGS);
            }, function (error) {
                console.log(error)
            });

            self.client.doAuthenticatedRequest('/' + "JA100" + '/thermoDevicesGet.json', payload, self.sessionId, function (response) {
                if (self.debug === true) {
                    self.log("Available Thermodevices: " + JSON.stringify(response, null, 4));
                }

                let sections = response['data']['thermo-devices'];
                sections.forEach(function (section) {
                    if (self.isSectionEligible(section)) {
                        let accessory = self.createAccessory(section);
                        self.service.thermometers.push(accessory);
                    }
                })

                self.printConfig(THERMOMETERS);
            }, function (error) {
                console.log(error)
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
    let service_type = "ja100";

    for (let i = 0; i < process.argv.length; i++) {
        if (process.argv[i] === '-d') {
            debug = true;
        }
    }

    let helper = new JablotronConfigHelper(username, password, service_type, console.log, debug);
    helper.getAccessories();
}
