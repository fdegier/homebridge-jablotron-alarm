const querystring = require('querystring'); 
const https = require('https');

module.exports = JablotronClient;

function JablotronClient(log) {
    this.log = log;    
    this.api_hostname = 'api.jablonet.net';
}

JablotronClient.prototype = {
    doAuthenticatedRequest: function(endpoint, payload, sessionId, callback) {
        var cookies = {
            'PHPSESSID': sessionId
        };

        var self = this;
        this.doRequest(endpoint, payload, cookies, function(response) {
            if (response['status']) {
                callback(response);    
            }
            else {
                self.log(response);
                throw Error(response['error_status']);
            }
        });
    },

    doRequest: function(endpoint, payload, cookies, callback) {
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
                callback(JSON.parse(data));
            });
          
          }).on("error", (err) => {
            this.log("Error: " + err.message);
          });

        req.write(postData);
        req.end();
    }
}