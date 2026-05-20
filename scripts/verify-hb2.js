#!/usr/bin/env node
'use strict';

/**
 * Smoke test: load accessories with HAP-NodeJS v1 APIs (same as Homebridge 2).
 * Does not call the Jablotron cloud API.
 *
 * Run: npm run verify
 */

const path = require('path');
const hap = require('hap-nodejs');
const JablotronAccessory = require('../lib/accessory');
const JablotronConstants = require('../lib/const');

const log = {
    log: () => {},
    error: (msg) => console.error(msg),
    warn: () => {},
    debug: () => {},
};

const mockPlatform = {
    getLog: () => log,
    getAPI: () => ({ hap }),
};

const mockService = {
    getPlatform: () => mockPlatform,
    getLog: () => log,
    getServiceConfig: () => ({
        isAutoRefresh: () => true,
    }),
    debug: () => {},
};

const accessoryTypes = [
    [JablotronConstants.ACCESSORY_SECTION, { name: 'House', segment_id: 'SEC-00000001', partiallyArmedMode: 'Home' }],
    [JablotronConstants.ACCESSORY_SWITCH, { name: 'Siren', segment_id: 'PG-00000001' }],
    [JablotronConstants.ACCESSORY_OUTLET, { name: 'Camera', segment_id: 'PG-00000002' }],
    [JablotronConstants.ACCESSORY_CONTACT_SENSOR, { name: 'Door', segment_id: 'PG-00000003' }],
    [JablotronConstants.ACCESSORY_THERMOMETER, { name: 'Temp', segment_id: 'THM-00000001', min_temperature: -10, max_temperature: 50 }],
];

let failed = 0;

for (const [type, config] of accessoryTypes) {
    try {
        const accessory = new JablotronAccessory(mockService, config, type);
        const services = accessory.getServices();
        if (!services || services.length < 2) {
            throw new Error(`expected at least 2 services, got ${services ? services.length : 0}`);
        }
        console.log(`OK  ${type}: ${services.length} services`);
    } catch (err) {
        failed++;
        console.error(`FAIL ${type}:`, err.message);
    }
}

if (failed > 0) {
    process.exit(1);
}

console.log('\nAll accessory types loaded with HAP-NodeJS v1 APIs.');
