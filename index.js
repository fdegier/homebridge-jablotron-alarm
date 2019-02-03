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
    var self = this;

    // Try to fetch alarm state every 15 minutes.
    // When we fail, we invalidate sessionId and refetch new one into cache, this way we ensure, that sessionId is always valid when needed.
    // Used for responsiveness as sessionId expires quickly and takes time to get new one.
    setInterval(function(){
        self.jablotron.isAlarmActive(() => {});
      }, 900000);
}

JablotronSecuritySystemAccessory.prototype = {

    setTargetState: function(state, callback) {
        this.log("Switching to state: " + state);
        var self = this;

        if (state == "3" || state == "0") {
            this.jablotron.deactivateAlarm(function(didStateChanged) {
                if (didStateChanged) {
                    self.securityService.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                    callback(null, state);
                }
            })
        } else if (state == "2") {
            this.jablotron.partialActivateAlarm(function(didStateChanged) {
            if (didStateChanged) {
                self.securityService.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                callback(null, state);
            }
        })
        } else {
            this.jablotron.activateAlarm(function(didStateChanged) {
                if (didStateChanged) {
                    self.securityService.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                    callback(null, state);
                }
            })
        }
    },

    getState: function(callback) {
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
