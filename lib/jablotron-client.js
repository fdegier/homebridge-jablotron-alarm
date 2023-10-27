// noinspection JSUnresolvedReference,NodeCoreCodingAssistance

'use strict';

const querystring = require('querystring');
const https = require('https');
const JablotronConstants = require('./const');

function JablotronClient(log) {
    this.log = log;
    this.api_hostname = 'api.jablonet.net';
}

JablotronClient.prototype = {
    containsErrorCode: function (response ) {
        if (response['data']['control-errors']) {
            errors = response['data']['control-errors'];
            console.log("JABLOTRON: Control error code: " + response['data']['control-errors']);
        } else if (response['errors']) {
            errors = response['errors'];
            console.log("JABLOTRON: Error code: " + response['errors']);
        } else {
            console.log("JABLOTRON: No error code found");
            return false;
        }
    },

    matchesErrorCode: function (response, errorCode = undefined) {
        // Errors can be in two keys: 'errors' and 'control-errors'
        let errors = [];
        if (response['data']['control-errors']) {
            errors = response['data']['control-errors'];
            console.log("JABLOTRON: Control error code: " + response['data']['control-errors']);
        } else if (response['errors']) {
            errors = response['errors'];
            console.log("JABLOTRON: Error code: " + response['errors']);
        } else {
            console.log("JABLOTRON: No error code found");
            return false;
        }
        if (errorCode === undefined) {
            return errors;
        } else if (JablotronConstants.isValidVariable(errors) && Array.isArray(errors) && errors.length > 0) {
            console.log("JABLOTRON: Error code: " + errors);
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
            console.log("JABLOTRON: Response: " + JSON.stringify(response));
            // Check if data does not contain errors
            self.matchesErrorCode(response);
            if (response['data']) {
                successCallback(response);
            } else if (response['errors'][0]['message'] === 'Operation failed') {
                errorCallback(new Error('Operation failed'))
            } else if (self.matchesErrorCode(response, 'METHOD.NOT-SUPPORTED')) {
                errorCallback(new Error('Method not supported by Jablotron'));
            } else {
                self.log(response);
                errorCallback(new Error(response['errors']));
            }
        }, errorCallback);
    },

    doRequest: function (endpoint, payload, cookies, successCallback, errorCallback) {
        let postData = JSON.stringify(payload);
        let cookiesData = querystring.stringify(cookies);
        let self = this;

        let options = {
            hostname: this.api_hostname,
            port: 443,
            path: '/api/1.9' + endpoint,
            method: 'POST',
            headers: {
                'Cookie': cookiesData,
                'x-vendor-id': 'JABLOTRON:Jablotron',
                'Content-Type': 'application/json',
                "x-client-version": "MYJ-PUB-ANDROID-12",
                "accept-encoding": "*",
                "Accept": "application/json",
                "Content-Type": "application/json",
                'Accept-Language': 'en',
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
