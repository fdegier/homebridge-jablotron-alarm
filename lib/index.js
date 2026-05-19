'use strict';

const PLUGIN_NAME = 'homebridge-jablotron';
const PLATFORM_NAME = 'Jablotron';

const JablotronPlatform = require('./platform');

/**
 * Moderne plugin initialisatie (aanbevolen sinds Homebridge v1.0+ / v2.0)
 * - Geen magic strings meer
 * - Gebruikt de officiële api parameter
 * - Geen 4e parameter 'true' meer nodig (wordt bepaald door de platform class)
 */
module.exports = (api) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, JablotronPlatform);
};