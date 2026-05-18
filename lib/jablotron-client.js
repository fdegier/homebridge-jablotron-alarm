// noinspection JSUnresolvedReference,NodeCoreCodingAssistance

'use strict';

const https = require('https');

function JablotronClient(log) {
    this.log = log;
    this.apiHostname = 'api.jablonet.net';
}

JablotronClient.prototype = {

    containsErrorCode: function (response) {
        if (response?.data?.['control-errors']) {
            return response.data['control-errors'];
        }
        if (response?.errors) {
            return response.errors;
        }
        return null;
    },

    doAuthenticatedRequest: function (endpoint, payload, sessionId, successCallback, errorCallback) {
        const self = this;

        this.doRequest(endpoint, payload, sessionId, false, function (response) {
            const errors = self.containsErrorCode(response);
            if (errors) {
                errorCallback(errors);
            } else if (response?.data) {
                successCallback(response);
            } else {
                errorCallback(new Error('No data in response'));
            }
        }, errorCallback);
    },

    doRequest: function (endpoint, payload, cookies, isLogin, successCallback, errorCallback) {
        const self = this;
        const postData = JSON.stringify(payload || {});

        const options = {
            hostname: this.apiHostname,
            port: 443,
            path: '/api/2.2' + endpoint,
            method: 'POST',
            timeout: 20000,
            headers: {
                'Cookie': cookies || '',
                'x-vendor-id': 'JABLOTRON:Jablotron',
                'Content-Type': 'application/json',
                'x-client-version': 'MYJ-PUB-ANDROID-12',
                'Accept': 'application/json',
                'Accept-Language': 'en',
            }
        };

        const req = https.request(options, (resp) => {
            if (!resp) {
                return errorCallback([{ code: 'JABLOTRON_UNDEFINED_RESPONSE' }]);
            }

            if (resp.statusCode === 502) {
                return errorCallback([{ code: 'BAD_GATEWAY', message: 'Bad Gateway' }]);
            }

            // Login flow or 401 handling
            if (isLogin || resp.statusCode === 401) {
                if (resp.statusCode === 401) {
                    self.log('Jablotron - logging in due to 401');
                }
                const setCookie = resp.headers['set-cookie'];
                if (setCookie) {
                    const sessionId = setCookie.toString().split(';')[0];
                    return successCallback(sessionId);
                }
            }

            let data = '';

            resp.on('data', (chunk) => {
                data += chunk;
            });

            resp.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const errors = self.containsErrorCode(json);

                    if (errors) {
                        return errorCallback(errors);
                    }

                    successCallback(json);
                } catch (e) {
                    self.log('Jablotron - JSON parsing error: ' + (e.stack || e));
                    errorCallback('Unable to parse JSON response');
                }
            });
        });

        req.on('error', (error) => {
            self.log('Jablotron request error: ' + error.message);
            if (errorCallback) errorCallback(error);
        });

        req.write(postData);
        req.end();
    }
};

module.exports = JablotronClient;
