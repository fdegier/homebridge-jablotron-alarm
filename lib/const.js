'use strict';

const ACCESSORY_SECTION = 'section';
const ACCESSORY_SWITCH = "switch";
const ACCESSORY_OUTLET = 'outlet';

const JABLOTRON_JA100 = 'ja100';
const JABLOTRON_SECTION = 'section';
const JABLOTRON_PGM = 'pgm';

const JABLOTRON_ARMED = 'set';
const JABLOTRON_PARTIALLY_ARMED = 'partialSet';
const JABLOTRON_DISARMED = 'unset';

const DEFAULT_AUTO_REFRESH = true;
const DEFAULT_POLL_INTERVAL = 60;
const DEFAULT_REFRESH_ON_STATE_CHANGE = true;
const DEFAULT_DEBUG = false;
const DEFAULT_SEGMENT_ID = 'STATE_1';
const DEFAULT_SEGMENT_KEY = 'section_1';
const DEFAULT_KEYBOARD_KEY = null;

module.exports = {
    // Methods
    readConfigValue,
    isJablotronArmed,
    isJablotronPartiallyArmed,

    // Constants
    ACCESSORY_SECTION,
    ACCESSORY_SWITCH,
    ACCESSORY_OUTLET,
    JABLOTRON_JA100,
    JABLOTRON_SECTION,
    JABLOTRON_PGM,
    JABLOTRON_ARMED,
    JABLOTRON_PARTIALLY_ARMED,
    JABLOTRON_DISARMED,
    DEFAULT_AUTO_REFRESH,
    DEFAULT_POLL_INTERVAL,
    DEFAULT_REFRESH_ON_STATE_CHANGE,
    DEFAULT_DEBUG,
    DEFAULT_SEGMENT_ID,
    DEFAULT_SEGMENT_KEY,
    DEFAULT_KEYBOARD_KEY
};

function readConfigValue(config, key, defaultValue) {
    let value = config[key];
    if (value != undefined) {
        return value;
    }

    return defaultValue;
}

function isJablotronArmed(state) {
    return JABLOTRON_ARMED == state;
}

function isJablotronPartiallyArmed(state) {
    return JABLOTRON_PARTIALLY_ARMED == state;
}
