'use strict';

const https = require('https');

class JablotronClient {

    constructor(log) {
        this.log = log;
        this.apiHostname = 'api.jablonet.net';
    }

    containsErrorCode(response) {
        if (response?.data?.['control-errors']) {
            return response.data['control-errors'];
        }
        if (response?.errors) {
            return response.errors;
        }
        return null;
    }

    // ==================== NIEUWE ASYNC METHODES ====================

    doRequestAsync(endpoint, payload, cookies = '', isLogin = false) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(payload || {});

            const options = {
                hostname: this.apiHostname,
                port: 443,
                path: '/api/2.2' + endpoint,
                method: 'POST',
                timeout: 20000,
                headers: {
                    'Cookie': cookies,
                    'x-vendor-id': 'JABLOTRON:Jablotron',
                    'Content-Type': 'application/json',
                    'x-client-version': 'MYJ-PUB-ANDROID-12',
                    'Accept': 'application/json',
                    'Accept-Language': 'en',
                }
            };

            const req = https.request(options, (resp) => {
                if (!resp) {
                    return reject([{ code: 'JABLOTRON_UNDEFINED_RESPONSE' }]);
                }

                if (resp.statusCode === 502) {
                    return reject([{ code: 'BAD_GATEWAY', message: 'Bad Gateway' }]);
                }

                // Login flow of 401 handling
                if (isLogin || resp.statusCode === 401) {
                    if (resp.statusCode === 401) {
                        this.log('Jablotron - logging in due to 401');
                    }
                    const setCookie = resp.headers['set-cookie'];
                    if (setCookie) {
                        const sessionId = setCookie.toString().split(';')[0];
                        return resolve(sessionId);
                    }
                }

                let data = '';

                resp.on('data', (chunk) => {
                    data += chunk;
                });

                resp.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const errors = this.containsErrorCode(json);

                        if (errors) {
                            return reject(errors);
                        }

                        resolve(json);
                    } catch (e) {
                        this.log('Jablotron - JSON parsing error: ' + (e.stack || e));
                        reject('Unable to parse JSON response');
                    }
                });
            });

            req.on('error', (error) => {
                this.log('Jablotron request error: ' + error.message);
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    }

    async doAuthenticatedRequestAsync(endpoint, payload, sessionId) {
        const response = await this.doRequestAsync(endpoint, payload, sessionId, false);
        const errors = this.containsErrorCode(response);

        if (errors) {
            throw errors;
        }

        if (!response?.data) {
            throw new Error('No data in response');
        }

        return response;
    }

    // ==================== OUDE CALLBACK METHODES (backward compatibiliteit) ====================

    doRequest(endpoint, payload, cookies, isLogin, successCallback, errorCallback) {
        this.doRequestAsync(endpoint, payload, cookies, isLogin)
            .then(successCallback)
            .catch(errorCallback);
    }

    doAuthenticatedRequest(endpoint, payload, sessionId, successCallback, errorCallback) {
        this.doAuthenticatedRequestAsync(endpoint, payload, sessionId)
            .then(successCallback)
            .catch(errorCallback);
    }
}

module.exports = JablotronClient;