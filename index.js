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
}

JablotronSecuritySystemAccessory.prototype = {

    setTargetState: function(state, callback) {
        this.log("Switching to state: " + state);
        var self = this;

        if (state == "3") {
            this.jablotron.deactivateAlarm(function(didStateChanged) {
                if (didStateChanged) {
                    self.securityService.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                    callback(null, state);
                }
            })
        }
        else {
            this.jablotron.activateAlarm(function(didStateChanged) {
                if (didStateChanged) {
                    self.securityService.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                    callback(null, state);
                }
            })
        }
    },

    getState: function(callback) {
        var self = this;
        this.jablotron.isAlarmActive(function(isAlarmActive){
            self.log("Is alarm active? " + isAlarmActive);

            var state = isAlarmActive ? Characteristic.SecuritySystemCurrentState.AWAY_ARM : Characteristic.SecuritySystemCurrentState.DISARMED;
            self.securityService.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
            callback(null, state);
        })
    },

    getCurrentState: function(callback) {
        this.log("Getting current state");
        this.getState(callback);
    },

    getTargetState: function(callback) {
        this.log("Getting target state");
        this.getState(callback);
    },

    identify: function(callback) {
        this.log("Identify requested!");
        callback(); // success
    },

    getServices: function() {
        this.securityService = new Service.SecuritySystem(this.name);

        this.securityService
            .getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .on('get', this.getCurrentState.bind(this));

        this.securityService
            .getCharacteristic(Characteristic.SecuritySystemTargetState)
            .on('get', this.getTargetState.bind(this))
            .on('set', this.setTargetState.bind(this));

        return [this.securityService];
    }
};
