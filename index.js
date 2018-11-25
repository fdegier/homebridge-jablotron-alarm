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
    this.allow_caching_of_state = config['allow_caching_of_state']
    this.jablotronPythonScriptPath = __dirname + "/jablotron.py";
}

JablotronSecuritySystemAccessory.prototype = {

    logStream: function(stream) {
        var output = "";

        stream.on('data', function (data){                                                     
            output += data;                                                                            
        });                                                                                            
                                                                                                       
        stream.on('end', function (data){                                                      
            this.log(output);                                                                          
        });
    },

    spawnPythonProcess: function(state)
    {
        this.log("Calling Python to set state: %s", state);

        var spawn = require("child_process").spawn;
        return spawn('python3',[jablotronPythonScriptPath, state, this.username, this.password, this.pincode, this.service_id, this.segment, this.allow_caching_of_state]);
    },

    getSecuritySystemState: function(stringState) {
        const stateDictionary = {
            'DISARMED': Characteristic.SecuritySystemCurrentState.DISARMED,
            'AWAY_ARM': Characteristic.SecuritySystemCurrentState.AWAY_ARM,
            'STAY_ARM': Characteristic.SecuritySystemCurrentState.STAY_ARM,
            'NIGHT_ARM': Characteristic.SecuritySystemCurrentState.NIGHT_ARM
        };

        return stateDictionary[stringState];
    },

    setTargetState: function(state, callback) {
        var process = this.spawnPythonProcess(state)
        
        logStream(process.stderr);
        logStream(process.stdout);

        this.securityService.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
        callback(null, state);
    },

    getState: function(callback) {
        var process = this.spawnPythonProcess('getState')
        
        logStream(process.stderr);
        logStream(process.stdout);
        
        var output = "";

        process.stdout.on('data', function (data){
            output += data;
        });

        process.stdout.on('end', function () {
            var state = getSecuritySystemState(output);
            this.securityService.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
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
