const querystring = require('querystring'); 
const https = require('https');

module.exports = JablotronClient;

function JablotronClient(log) {
    this.log = log;    
    this.api_hostname = 'api.jablonet.net';
}

JablotronClient.prototype = {
    doAuthenticatedRequest: function(endpoint, payload, sessionId, successCallback, errorCallback) {
        var cookies = {
            'PHPSESSID': sessionId
        };

        var self = this;
        this.doRequest(endpoint, payload, cookies, function(response) {
            if (response['status']) {
                successCallback(response);    
            }
            else {
                self.log(response);
                errorCallback(new Error(response['error_status']))
            }
        }, function(error){
            errorCallback(error);
        });
    },

    doRequest: function(endpoint, payload, cookies, successCallback, errorCallback) {
        var postData = querystring.stringify(payload);
        var cookiesData = querystring.stringify(cookies);

        var options = {
            hostname: this.api_hostname,
            port: 443,
            path: '/api/1.6' + endpoint,
            method: 'POST',
            headers: {
                'Cookie': cookiesData,
                'x-vendor-id': 'MyJABLOTRON',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length
               }
          };

        var req = https.request(options, (resp) => {
            var data = '';
            resp.on('data', (chunk) => {
              data += chunk;
            });
          
            resp.on('end', () => {
                successCallback(JSON.parse(data));
            });
          
          }).on("error", (err) => {
            this.log("Error: " + err.message);
            errorCallback(err);
          });

        req.write(postData);
        req.end();
    }
}