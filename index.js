var Service, Characteristic;

module.exports = function(homebridge){
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-jablotron", "Homebridge-Jablotron", JablotronSecuritySystemAccessory);
}
function JablotronSecuritySystemAccessory(log, config) {
    this.log = log;
    this.username = config['username'];
    this.password = config['password'];
    this.pincode = config['pincode'];
    this.service_id = config['service_id'];
    this.segment = config['segment'];
}

JablotronSecuritySystemAccessory.prototype = {

    setTargetState: function(state, callback) {
        this.log("Setting state to %s", state);

        var self = this;
        var spawn = require("child_process").spawn;
        self.log("Calling Python to set state");
        var process = spawn('python3',["/home/pi/.npm-global/lib/node_modules/homebridge-jablotron/jablotron.py", state, this.username, this.password, this.pincode, this.service_id, this.segment]); //    Send the state to Python
        var output = "";

        process.stdout.on('data', function (data){
            output += data;
        });

        process.stdout.on('end', function () {
            self.log(output);
        });

        self.securityService.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
        callback(null, state);
    },

    getState: function(callback) {
        var self = this;

        self.log("getting alarm state:");
        var spawn = require("child_process").spawn;
        self.log("Calling Python to get state");
        var process = spawn('python3',["/home/pi/.npm-global/lib/node_modules/homebridge-jablotron/jablotron.py", "getState", this.username, this.password, this.pincode, this.service_id, this.segment]); //    Send the state to Python
        var output = "";

        process.stdout.on('data', function (data){
            output += data;
        });

        process.stdout.on('end', function () {
            self.log(output);
            if (output == "DISARMED") {
                var state = Characteristic.SecuritySystemCurrentState.DISARMED;
            } else if (output == "AWAY_ARM") {
                var state = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
            } else if (output == "STAY_ARM") {
                var state = Characteristic.SecuritySystemCurrentState.STAY_ARM;
            } else if (output == "NIGHT_ARM") {
                var state = Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
            };
            self.securityService.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
            callback(null, state);
        });
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
