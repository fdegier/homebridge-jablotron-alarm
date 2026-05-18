// noinspection JSUnresolvedFunction,JSUnresolvedVariable

'use strict';

const JablotronPlatform = require('./platform');

module.exports = function (homebridge) {
    // Registreer als Dynamic Platform (beter voor Child Bridge)
    homebridge.registerPlatform("homebridge-jablotron", "Jablotron", JablotronPlatform, true);
};