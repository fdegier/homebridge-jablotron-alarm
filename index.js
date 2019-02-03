const Jablotron = require('./Jablotron');
const JablotronClient = require('./Jablotron/jablotronClient.js');

var Service, Characteristic;

module.exports = function(homebridge){
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-jablotron", "Homebridge-Jablotron", JablotronSecuritySystemAccessory);
}

function JablotronSecuritySystemAccessory(log, config) {
    this.log = log;
    this.jablotron = new Jablotron(log, config, new JablotronClient(log));
    this.name = config['name'];
    this.partialSetMapping = Characteristic.SecuritySystemCurrentState.STAY_ARM;

    var partSet = config['partial_set_mapping'];
    if (partSet) {
        this.partialSetMapping = (partSet == "HOME" ? Characteristic.SecuritySystemCurrentState.STAY_ARM : Characteristic.SecuritySystemCurrentState.NIGHT_ARM);
    }

    var accType = config['type'];
    if (accType) {
        this.type = accType;
    } else {
        this.type = "alarm";
    }

    var self = this;
    setInterval(function() {
        self.jablotron.getSegmentState(self.getSegmentType(),() => {});
    }, 900000);
}

JablotronSecuritySystemAccessory.prototype = {

    getSegmentType: function() {
        if (this.type == "alarm") {
            return "section";
        }

        return "pgm";
    },

    setTargetAlarmState: function(state, callback) {
        this.log("Setting alarm state: " + state);
        var self = this;

        if (state == "3") {
            this.jablotron.deactivateSegment(function(didStateChanged) {
                if (didStateChanged) {
                    self.service.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                    callback(null, state);
                }
            })
        } else if (state == "2" || state == "0") {
            this.jablotron.partiallyActivateSegment(function(didStateChanged) {
                if (didStateChanged) {
                    self.service.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                    callback(null, state);
                }
            })
        } else {
            this.jablotron.activateSegment(function(didStateChanged) {
                if (didStateChanged) {
                    self.service.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                    callback(null, state);
                }
            })
        }
    },

    getAlarmState: function(callback) {
        this.log("Getting state of alarm ...");
        var self = this;
        this.jablotron.getSegmentState(this.getSegmentType(), function(alarmState) {
            self.log("Alarm state: " + alarmState);

            var state = Characteristic.SecuritySystemCurrentState.DISARMED;
            if (alarmState == "partialSet") {
                state = this.partialSetMapping;
            } else if (alarmState == "set") {
                state = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
            }
            self.service.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
            callback(null, state);
        })
    },

    setTargetSwitchState: function(state, callback) {
        this.log("Setting switch state: " + state);

        if (state == true) {
            this.jablotron.activateSegment(function(didStateChanged) {
                if (didStateChanged) {
                    callback(null, state);
                }
            })
        } else {
            this.jablotron.deactivateSegment(function(didStateChanged) {
                if (didStateChanged) {
                    callback(null, state);
                }
            })
        }
    },

    getSwitchState: function(callback) {
        var self = this;
        this.jablotron.getSegmentState(this.getSegmentType(), function(switchState) {
            self.log("Switch state: " + switchState);

            var state = switchState == "set" ? true : false;
            callback(null, state);
        })
    },

    getCurrentAlarmState: function(callback) {
        this.getAlarmState(callback);
    },

    getTargetAlarmState: function(callback) {
        this.getAlarmState(callback);
    },

    getTargetSwitchState: function(callback) {
        this.getSwitchState(callback);
    },

    identify: function(callback) {
        callback();
    },

    getServices: function() {
        if (this.type == "switch") {
            this.service = new Service.Switch(this.name);

            this.service
                .getCharacteristic(Characteristic.On)
                .on('set', this.setTargetSwitchState.bind(this))
                .on('get', this.getTargetSwitchState.bind(this));

            return [this.service];
        } else {
            this.service = new Service.SecuritySystem(this.name);

            this.service
                .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .on('get', this.getCurrentAlarmState.bind(this));

            this.service
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .on('get', this.getTargetAlarmState.bind(this))
                .on('set', this.setTargetAlarmState.bind(this));

            return [this.service];
        }
    }
};
