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

    var accType = config['type'];
    if (accType) {
        this.type = accType;
    } else {
        this.type = 'alarm';
    }

    var self = this;
    setInterval(function(){
        self.jablotron.isAlarmActive(() => {});
      }, 900000);
}

JablotronSecuritySystemAccessory.prototype = {

    setTargetAlarmState: function(state, callback) {
        this.log("Setting alarm state: " + state);
        var self = this;

        if (state == "3" || state == "0") {
            this.jablotron.deactivateAlarm(function(didStateChanged) {
                if (didStateChanged) {
                    self.service.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                    callback(null, state);
                }
            })
        } else if (state == "2") {
            this.jablotron.partialActivateAlarm(function(didStateChanged) {
            if (didStateChanged) {
                self.service.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                callback(null, state);
            }
        })
        } else {
            this.jablotron.activateAlarm(function(didStateChanged) {
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
        this.jablotron.getAlarmState(function(alarmState){
            self.log("Alarm state: " + alarmState);

            var state = Characteristic.SecuritySystemCurrentState.DISARMED;
            if (alarmState == "partialSet") {
                state = Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
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
            this.jablotron.activateAlarm(function(didStateChanged) {
                if (didStateChanged) {
                    callback(null, state);
                }
            })
        } else {
            this.jablotron.deactivateAlarm(function(didStateChanged) {
                if (didStateChanged) {
                    callback(null, state);
                }
            })
        }
    },

    getSwitchState: function(callback) {
        this.log("Getting state of switch ...");
        var self = this;
        this.jablotron.getSwitchState(function(switchState){
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
