'use strict';

const querystring = require('querystring');
const https = require('https');

function JablotronClient(log) {
    this.log = log;
    this.api_hostname = 'api.jablonet.net';
}

JablotronClient.prototype = {
    doAuthenticatedRequest: function (endpoint, payload, sessionId, successCallback, errorCallback) {
        var cookies = {
            'PHPSESSID': sessionId
        };

        var self = this;
        this.doRequest(endpoint, payload, cookies, function (response) {
            if (response['status']) {
                successCallback(response);
            } else if (response['error_message'] == 'Operation failed'){
                errorCallback(new Error(response['error_message']))
            } else {
                self.log(response);
                errorCallback(new Error(response['error_status']))
            }
        }, errorCallback);
    },

    doRequest: function (endpoint, payload, cookies, successCallback, errorCallback) {
        var postData = querystring.stringify(payload);
        var cookiesData = querystring.stringify(cookies);
        var self = this;

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

        var req = https.request(options, function (resp) {
            var data = '';

            resp.on('data', function (chunk) {
                data += chunk;
            });

            resp.on('end', function () {
                successCallback(JSON.parse(data));
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
}

module.exports = JablotronClient;
