'use strict';

const querystring = require('querystring');
const https = require('https');
const JablotronConstants = require('./const');

function JablotronClient(log) {
    this.log = log;
    this.api_hostname = 'api.jablonet.net';
}

JablotronClient.prototype = {
    matchesErrorCode: function (response, errorCode) {
        let errors = response['errors'];
        if (JablotronConstants.isValidVariable(errors) && Array.isArray(errors) && errors.length > 0) {
            return errors[0]['code'] === errorCode;
        }
        return false;
    },

    doAuthenticatedRequest: function (endpoint, payload, sessionId, successCallback, errorCallback) {
        let cookies = {
            'PHPSESSID': sessionId
        };

        let self = this;
        this.doRequest(endpoint, payload, cookies, function (response) {
            if (response['status']) {
                successCallback(response);
            } else if (response['error_message'] === 'Operation failed') {
                errorCallback(new Error('Operation failed'))
            } else if (self.matchesErrorCode(response, 'METHOD.NOT-SUPPORTED')) {
                errorCallback(new Error('Method not supported by Jablotron'));
            } else {
                self.log(response);
                errorCallback(new Error(response['error_status']));
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
                    self.log("Jablotron - json parsing error: " + (e.stack || e));
                    errorCallback("Unable to parse JSON data: " + data);
                }
            });
        });

        req.on('error', function (error) {
            self.log("Jablotron error: " + error.message);

            if (errorCallback) {
                errorCallback(error);
            }
        });

        req.write(postData);
        req.end();
    }
};

module.exports = JablotronClient;
