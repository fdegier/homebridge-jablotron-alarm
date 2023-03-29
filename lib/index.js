// noinspection JSUnresolvedFunction,JSUnresolvedVariable

'use strict';

const JablotronPlatform = require('./platform');

module.exports = function (homebridge) {
    homebridge.registerPlatform("homebridge-jablotron", "Jablotron", JablotronPlatform);
}
