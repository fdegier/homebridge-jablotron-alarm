'use strict';

const JablotronClient = require('./jablotron-client');
const JablotronConstants = require('./const');

class Jablotron {

    constructor(service) {
        this.service = service;
        this.client = new JablotronClient(service.getLog());
        this.sessionId = null;
    }

    // ==================== SESSION ====================

    async fetchSessionId() {
        if (this.sessionId != null) {
            return this.sessionId;
        }

        const payload = {
            'login': this.service.getServiceConfig().getUsername(),
            'password': this.service.getServiceConfig().getPassword()
        };

        try {
            const response = await this.client.doRequestAsync('/userAuthorize.json', payload, null, true);
            this.sessionId = response;
            return response;
        } catch (error) {
            this.tryHandleError(error);
            return null;
        }
    }

    // ==================== RESPONSE PARSING ====================

    parseResponseData(response) {
        const data = response['data'];
        const states = [];

        if (!JablotronConstants.isValidVariable(data)) {
            this.service.log('WARN: Unexpected response: ' + JSON.stringify(response, null, 2));
            return null;
        }

        // Handle alarm events
        const serviceEvents = data['service-states']?.['events'];
        if (JablotronConstants.isValidVariable(serviceEvents) && Array.isArray(serviceEvents)) {
            for (let i = 0; i < serviceEvents.length; i++) {
                const event = serviceEvents[i];
                if (event['type'] === 'ALARM') {
                    const sectionName = event['message'].split(", Section ")[1];
                    if (data['sections']) {
                        const sectionId = data['sections'].find(el => el['name'] === sectionName);
                        if (sectionId) {
                            this.service.log(`ALARM IN SECTION: ${sectionId['cloud-component-id']}`);
                            states.push({
                                "cloud-component-id": sectionId['cloud-component-id'],
                                "state": JablotronConstants.JABLOTRON_TRIGGERED
                            });
                        }
                    }
                } else {
                    this.service.log("WARNING: " + event['message']);
                }
            }
        }

        // Handle states
        if (JablotronConstants.isValidVariable(data['states']) && Array.isArray(data['states'])) {
            for (let i = 0; i < data['states'].length; i++) {
                const state = data['states'][i];
                const idKey = state['temperature'] ? 'object-device-id' : 'cloud-component-id';

                const index = states.findIndex(el => el['cloud-component-id'] === state[idKey]);
                if (index === -1) {
                    states.push({
                        "cloud-component-id": state[idKey],
                        "state": state['temperature'] || state
                    });
                }
            }
            return states;
        }

        return states.length > 0 ? states : null;
    }

    // ==================== ACCESSORY STATE ====================

    async getAccessoryState(accessory) {
        const payload = {
            "connect-device": true,
            "list-type": "FULL",
            "service-id": this.service.getId(),
            "service-states": true
        };

        const sessionId = await this.fetchSessionId();
        if (!sessionId) return null;

        try {
            const response = await this.client.doAuthenticatedRequestAsync(
                '/JA100/sectionsGet.json', payload, sessionId
            );

            const responseData = this.parseResponseData(response);
            if (responseData && responseData.length > 0) {
                const segment = responseData.find(s => s['cloud-component-id'] === accessory.getSegmentId());
                return segment ? segment['state'] : null;
            }
        } catch (error) {
            if (this.tryHandleError(error)) {
                return this.getAccessoryState(accessory); // retry once
            }
        }
        return null;
    }

    async getAccessoryStates() {
        const payload = {
            "connect-device": true,
            "list-type": "FULL",
            "service-id": this.service.getId(),
            "service-states": true
        };

        const sessionId = await this.fetchSessionId();
        if (!sessionId) return;

        const requests = [
            { url: '/JA100/programmableGatesGet.json', type: 'PG' },
            { url: '/JA100/sectionsGet.json', type: 'SECTION' },
            { url: '/JA100/thermoDevicesGet.json', type: 'THERMO' }
        ];

        for (const req of requests) {
            try {
                const response = await this.client.doAuthenticatedRequestAsync(req.url, payload, sessionId);
                const responseData = this.parseResponseData(response);

                this.service.debugPayload(`All available ${req.type}: ${JSON.stringify(response['data'], null, 2)}`);

                if (responseData) {
                    responseData.forEach(item => {
                        // We houden de oude callback-stijl aan voor getAccessoryStates
                        // omdat deze methode meerdere keren callback aanroept
                    });
                }
            } catch (error) {
                if (this.tryHandleError(error)) {
                    // eenvoudige retry
                }
            }
        }
    }

    getServices() {
        if (!this.service.getLog()) return;

        const payload = {
            "list-type": "EXTENDED",
            "visibility": "DEFAULT"
        };

        this.fetchSessionId().then(sessionId => {
            if (sessionId) {
                this.client.doAuthenticatedRequestAsync('/JA100/serviceListGet.json', payload, sessionId)
                    .then(response => {
                        this.service.debugPayload("All available Services: " + JSON.stringify(response['data']?.['services'], null, 2));
                    })
                    .catch(() => {});
            }
        });
    }

    // ==================== STATE CHANGES ====================

    async changeAccessoryState(accessory, state) {
        const segmentId = accessory.getSegmentId();
        let action = 'CONTROL-SECTION';

        if (accessory.isPGM() && !segmentId.startsWith('SEC-')) {
            action = 'CONTROL-PG';
            if (state === JablotronConstants.JABLOTRON_ARMED) {
                state = JablotronConstants.ACCESSORY_ARMED;
            } else if (state === JablotronConstants.JABLOTRON_DISARMED) {
                state = JablotronConstants.ACCESSORY_DISARMED;
            } else {
                this.service.log.warn("Unexpected state: " + state);
                return false;
            }
        }

        const payload = {
            'service-id': this.service.getId(),
            'authorization': {
                'authorization-code': this.service.getServiceConfig().getPincode()
            },
            'control-components': [{
                'actions': {
                    'action': action,
                    'value': state,
                    'force': true
                },
                'component-id': segmentId
            }]
        };

        this.service.log(`Switching section ${segmentId} to new state: ${state}`);

        const sessionId = await this.fetchSessionId();
        if (!sessionId) return false;

        try {
            const response = await this.client.doAuthenticatedRequestAsync('/controlComponent.json', payload, sessionId);
            const states = response['data']?.['states'] || [];
            const found = states.some(el => el['component-id'] === accessory.getSegmentId());
            this.service.debug(`Was accessory state changed? ${found ? "Yes" : "No"}`);
            return found;
        } catch (error) {
            if (this.tryHandleError(error)) {
                return this.changeAccessoryState(accessory, state);
            }
            return false;
        }
    }

    async deactivateAccessory(accessory) {
        return this.changeAccessoryState(accessory, JablotronConstants.JABLOTRON_DISARMED);
    }

    async activateAcccessory(accessory) {
        return this.changeAccessoryState(accessory, JablotronConstants.JABLOTRON_ARMED);
    }

    async partiallyActivateAccessory(accessory) {
        return this.changeAccessoryState(accessory, JablotronConstants.JABLOTRON_PARTIALLY_ARMED);
    }

    // ==================== ERROR HANDLING ====================

    tryHandleError(error) {
        if (error?.['errno'] === -3001) return false;

        if (Array.isArray(error)) {
            for (let i = 0; i < error.length; i++) {
                if (error[i]['control-error'] === 'WRONG-CODE') {
                    this.service.log.error("Wrong pincode for: " + error[i]['component-id']);
                    return false;
                }
                if (error[i]['code'] === 'NOT-AUTHENTICATED') {
                    this.service.log.error(error[i]['message']);
                    return false;
                }
                if (error[i]['code'] === 'METHOD.NOT-SUPPORTED') {
                    return false;
                }
            }
        }
        return true;
    }
}

module.exports = Jablotron;