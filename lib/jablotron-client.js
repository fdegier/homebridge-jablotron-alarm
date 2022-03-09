'use strict';

const querystring = require('querystring');
const https = require('https');

function JablotronClient(log) {
    this.log = log;
    this.api_hostname = 'api.jablonet.net';
}

JablotronClient.prototype = {
    doAuthenticatedRequest: function (endpoint, payload, sessionId, successCallback, errorCallback) {
        let cookies = {
            'PHPSESSID': sessionId
        };

        let self = this;
        this.doRequest(endpoint, payload, cookies, function (response) {
            if (response['status']) {
                successCallback(response);
            } else if (response['error_message'] == 'Operation failed') {
                errorCallback(new Error('Operation failed'))
            } else if (response['errors'][0]['code'] == 'METHOD.NOT-SUPPORTED') {
                errorCallback(new Error('Method not supported by Jablotron'))
            } else {
                self.log(response);
                errorCallback(new Error(response['error_status']))
            }
        }, errorCallback);
    },

    doRequest: function (endpoint, payload, cookies, successCallback, errorCallback) {
        let postData = querystring.stringify(payload);
        let cookiesData = querystring.stringify(cookies);
        let self = this;

        let options = {
            hostname: this.api_hostname,
            port: 443,
            path: '/api/1.8' + endpoint,
            method: 'POST',
            headers: {
                'Cookie': cookiesData,
                'x-vendor-id': 'MyJABLOTRON',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length
            }
        };

        let req = https.request(options, function (resp) {
            let data = '';

            resp.on('data', function (chunk) {
                data += chunk;
            });

            resp.on('end', function () {
                try {
                    successCallback(JSON.parse(data));
                } catch(e) {
                    self.log("Error: " + e);
                    errorCallback("Unable to parse JSON");
                }
            });
        });

        req.on('error', function (error) {
            self.log("Error: " + error.message);

            if (errorCallback && errorCallback != null) {
                errorCallback(error);
            }
        });

        req.write(postData);
        req.end();
    }
};

module.exports = JablotronClient;
