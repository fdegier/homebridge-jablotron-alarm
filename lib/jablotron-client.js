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
        let errors = [];
        // Try to accesss response['data']['control-errors'] but it can be undefined
        if (response['data'] && response['data']['control-errors']) {
            errors = response['data']['control-errors'];
        } else if (response['errors']) {
            errors = response['errors'];
        } else {
            return false;
        }
        return errors;
    },

    matchesErrorCode: function (response, errorCode = undefined) {
        // Errors can be in two keys: 'errors' and 'control-errors'
        let errors = [];
        if (response['data'] && response['data']['control-errors']) {
            errors = response['data']['control-errors'];
        } else if (response['errors']) {
            errors = response['errors'];
        } else {
            return false;
        }
        if (errorCode === undefined) {
            return errors;
        } else if (JablotronConstants.isValidVariable(errors) && Array.isArray(errors) && errors.length > 0) {
            return errors[0]['code'] === errorCode;
        }
        return false;
    },

    doAuthenticatedRequest: function (endpoint, payload, sessionId, successCallback, errorCallback) {
        let cookies = sessionId

        let self = this;
        this.doRequest(endpoint, payload, cookies, false, function (response) {
            // Check if data does not contain errors
            let errors = self.containsErrorCode(response);
            if (errors) {
                errorCallback(errors);
                return;
            } else if (response['data']) {
                successCallback(response);
            } else {
                errorCallback(new Error(errors));
            }
        }, errorCallback);
    },

    doRequest: function (endpoint, payload, cookies, login, successCallback, errorCallback) {
        let postData = JSON.stringify(payload);
        let cookiesData = cookies;

        let self = this;

        let options = {
            hostname: this.api_hostname,
            port: 443,
            path: '/api/2.2' + endpoint,
            method: 'POST',
            timeout: 20000,
            headers: {
                'Cookie': cookiesData,
                'x-vendor-id': 'JABLOTRON:Jablotron',
                'Content-Type': 'application/json',
                'x-client-version': 'MYJ-PUB-ANDROID-12',
                'accept-encoding': '*',
                'Accept': 'application/json',
                'Accept-Language': 'en',
            }
        };
        let req = https.request(options, function (resp) {
            if ( resp === undefined ) {
                errorCallback([{"code": "Jablotron - undefined response"}]);
                return;
            } else if ( resp.statusCode === 502 ) {
                return errorCallback([{'code': 'BAD-GATEWAY', 'message': "BAD GATEWAY"}]);
            } else if ( resp.statusCode === 200 ) {
                let errors = self.containsErrorCode(resp);
                if (errors) {
                    errorCallback(errors);
                    return;
                }
            }            
            if (login === true || resp.statusCode === 401) {
                if (resp.statusCode === 401) {
                    self.log("Jablotron - logining in due to 401")
                }
                let cookie = resp.headers['set-cookie'];
                // cookie looks like this PHPSESSID=0m5hf8cthnkks25q32adejp6e0; path=/
                // we need to extract the session id
                let sessionId = resp.headers['set-cookie'].toString().split(';')[0]
                successCallback(sessionId);
                return;
            }
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
                    errorCallback(JSON.stringify(options))
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
