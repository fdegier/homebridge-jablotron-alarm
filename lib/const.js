'use strict';

// ==================== ACCESSORY TYPES ====================
const ACCESSORY_SECTION = 'section';
const ACCESSORY_SWITCH = 'switch';
const ACCESSORY_OUTLET = 'outlet';
const ACCESSORY_THERMOMETER = 'thermometer';
const ACCESSORY_CONTACT_SENSOR = 'contact-sensor';

// ==================== JABLOTRON TYPES ====================
const JABLOTRON_SECTION = 'section';
const JABLOTRON_PGM = 'pgm';
const JABLOTRON_THERMOMETER = 'thermometer';
const JABLOTRON_CONTACT_SENSOR = 'contact-sensor';

// ==================== JABLOTRON STATES ====================
const JABLOTRON_ARMED = 'ARM';
const JABLOTRON_PARTIALLY_ARMED = 'PARTIAL_ARM';
const JABLOTRON_DISARMED = 'DISARM';
const JABLOTRON_TRIGGERED = 'ALARM';

// ==================== ACCESSORY STATES ====================
const ACCESSORY_ARMED = 'ON';
const ACCESSORY_DISARMED = 'OFF';

// ==================== DEFAULT VALUES ====================
const DEFAULT_AUTO_REFRESH = true;
const DEFAULT_POLL_INTERVAL = 60;
const DEFAULT_REFRESH_ON_STATE_CHANGE = true;
const DEFAULT_DEBUG = false;
const DEFAULT_DEBUG_PAYLOAD = false;
const DEFAULT_KEYBOARD_KEY = null;
const DEFAULT_MIN_TEMPERATURE = 0;
const DEFAULT_MAX_TEMPERATURE = 100;
const DEFAULT_REVERSED_STATUS = false;

// ==================== OTHER ====================
const INFORMATION_TEMPERATURE = 'temperature';
const JABLOTRON_MODEL = 'Jablotron JA-100';

// ==================== HOMEKIT MODES ====================
const MODE_HOME = 'Home';
const MODE_AWAY = 'Away';
const MODE_NIGHT = 'Night';
const MODE_OFF = 'Off';

// ==================== HELPER FUNCTIONS ====================

function readConfigValue(config, key, defaultValue) {
    const value = config[key];
    return isValidVariable(value) ? value : defaultValue;
}

function isJablotronArmed(state) {
    return JABLOTRON_ARMED === state;
}

function isAccessoryArmed(state) {
    return ACCESSORY_ARMED === state;
}

function isJablotronPartiallyArmed(state) {
    return JABLOTRON_PARTIALLY_ARMED === state;
}

function isJablotronTriggered(state) {
    return JABLOTRON_TRIGGERED === state;
}

function isValidVariable(value) {
    return value != null && typeof value !== 'undefined';
}

// ==================== EXPORT ====================

module.exports = {
    // Accessoire types
    ACCESSORY_SECTION,
    ACCESSORY_SWITCH,
    ACCESSORY_OUTLET,
    ACCESSORY_THERMOMETER,
    ACCESSORY_CONTACT_SENSOR,

    // Jablotron types
    JABLOTRON_SECTION,
    JABLOTRON_PGM,
    JABLOTRON_THERMOMETER,
    JABLOTRON_CONTACT_SENSOR,

    // States
    JABLOTRON_ARMED,
    JABLOTRON_PARTIALLY_ARMED,
    JABLOTRON_DISARMED,
    JABLOTRON_TRIGGERED,
    ACCESSORY_ARMED,
    ACCESSORY_DISARMED,

    // Defaults
    DEFAULT_AUTO_REFRESH,
    DEFAULT_POLL_INTERVAL,
    DEFAULT_REFRESH_ON_STATE_CHANGE,
    DEFAULT_DEBUG,
    DEFAULT_DEBUG_PAYLOAD,
    DEFAULT_KEYBOARD_KEY,
    DEFAULT_MIN_TEMPERATURE,
    DEFAULT_MAX_TEMPERATURE,
    DEFAULT_REVERSED_STATUS,

    // Overig
    INFORMATION_TEMPERATURE,
    JABLOTRON_MODEL,

    // Modes
    MODE_HOME,
    MODE_AWAY,
    MODE_NIGHT,
    MODE_OFF,

    // Helper functies
    readConfigValue,
    isJablotronArmed,
    isAccessoryArmed,
    isJablotronPartiallyArmed,
    isJablotronTriggered,
    isValidVariable
};