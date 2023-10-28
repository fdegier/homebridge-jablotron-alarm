[![npm version](https://badge.fury.io/js/homebridge-jablotron.svg)](https://badge.fury.io/js/homebridge-jablotron)
![dependencies](https://david-dm.org/fdegier/homebridge-jablotron-alarm.svg)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](http://unlicense.org/)
![Publish NPM](https://github.com/fdegier/homebridge-jablotron-alarm/workflows/Publish%20NPM/badge.svg)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
---

![alt-text](homekit.jpg)

## Enabling Homekit and Siri for Jablotron Alarms
In the beginning of 2017 I bought and installed a Jablotron JA-100 alarm system in my home, it was easy to install, works great and offers a lot of options for automation which is great since Ive automated 90% of the stuff I do in my house. However it was missing 1 feature, Homekit. Let’s fix that!

If you are unfamiliar with Homekit, it’s Apple’s home automation integration, it basically bundles all of your smart devices in the Home app and lets you control it from 1 app, share access to family and friends, but most importantly provide a secure gateway for remote access and location based automation. See: https://www.apple.com/ios/home/

The objective for the Jablotron Homekit integration is:
- Arm, disarm or partially arm the alarm based on location
- Control PGM Jablotron devices based on location
- Have other devices perform actions based on the status of the alarm
- Include the alarm in scenes
- Control Jablotron from the Home app
- Control Jablotron with Siri

## Sample Homebridge config

For an example of the config, see the [sample-config.json](sample-config.json) file in this repository.

### Configuring Jablotron services
Based on the output of the [configuration tool](#Identify-Jablotron-services-and-devices) you can decide what services you add to the configuration.
Typically there is single service configured (eg for home) but some people might have more services defined (eg home & office)

MAKE SURE YOU HAVE ACCEPTED THE JABLOTRON TERMS OF SERVICE OR YOUR ACCOUNT WILL NOT WORK.

Each service needs to be configured following attributes:
- **id**: mandatory, ID of service obtained by [configuration tool](#Identify-Jablotron-services-and-devices)
- **name**: mandatory, defines a name of a service
- **username**: mandatory, your Jablotron username, it is advised to create a new account for the sole purpose of controlling the alarm via Siri and limiting the authorization on that account.
- **password**: mandatory, corresponding Jablotron password
- **pincode**: mandatory, corresponding PIN code for Jablotron unit
- **autoRefresh**: optional [default value true], enables autorefresh mode that automatically polls the Jablotron status in interval defined using **pollInterval** attribute
- **pollInterval**: optional [default value 60], defines an interval (in seconds) in which plugin periodically checks for service's and its accessories' states
- **refreshOnStateChange**: optional [default value true], enables automatic refresh upon arm/disarm. This is typically used if you have other Jablotron accessories (eg outlets) set up and configured to automatically switch on/off based on alarm state
- **debug**: optional [default value false], provides more verbose and detailed logging. Set it to true in case of some issues only!

### Configuring Jablotron sections & accessories
For each service there needs to be at least one accessory defined. The available accessories can be obtained using [configuration tool](#Identify-Jablotron-services-and-devices)

The accessories are of 3 types:
- **section**: this is standard segment mounted on Jablotron keyboard unit
- **switch**: this is a switchable (PGM device) accessory connected to Jablotron unit (eg hooter/sirene)
- **outlet**: this is an outlet (PGM device) connected to Jablotron unit
- **thermometer**: this is a thermometer connected to Jablotron unit
- **contact sensor**: this is a PGM device being displayed as a contact sensor connected to Jablotron unit. You will need to configure this in F-link accordingly, 

Each accessory needs to be configured using following attributes:
- **name**: mandatory, name of the accessory (this will be shown in Homekit and typically corresponds to the name defined in Jablotron setup)
- **Cloud Component ID**: mandatory, ID of a segment assigned in Jablotron setup
- **min_temperature**: optional, min. temperature of Jablotron thermometer (returned by [configuration tool](#Identify-Jablotron-services-and-devices))
- **max_temperature**: optional, max. temperature of Jablotron thermometer (returned by [configuration tool](#Identify-Jablotron-services-and-devices))
- **reversed_status**: optional and valid for contacts sensors only. By default contact sensor is open when PGM is set and closed when unset. This option reverses the logic so that
contact sensor is open when PGM is unset and closed when set

### Support for partially armed state
If your Jablotron alarm was configured to support partially armed status, ie where single click on segment's arm key partially arms segment and double click on segment's arm key arms segment fully, you are able to configure the same in Homebridge as well.
All you need to know is keyboard key of segment's keyboard. To obtain this information proceed with steps for [identifying Jablotron services and devices](#Identify-Jablotron-services-and-devices).

### Mapping of Security System States
For sections you can now override mapping of armed/partially armed states to Homekit states. By default armed state is mapped to Away and
partially armed state is mapped to Home in Homekit. For each section you can now define additional 2 attributes:
- **armedMode**: Homekit mapping of armed state. Can be set to one of Home/Night/Away
- **partiallyArmedMode**: Homekit mapping of partially armed state. Can be set to one of Home/Night/Away

Each section will appear in Homekit with the right number of states. Without partially armed state it would always appear with Off/"Armed" states
With partially armed state it would appear as Off/"Partially Armed"/"Armed"

## Homekit integration
The alarm integrates into Homekit as standard security alarm device. Homekit supports 4 states:
- Home (Stay)
- Away
- Night
- Off

Home/Away/Night are all of "On" state and indicate an armed alarm
Off indicates disarmed alarm

Jablotron alarm supports 3 states only:
- Disarmed
- Partially armed
- Armed

Disarmed is mapped to Off in Homekit. Partially armed is mapped to Home in Homekit. Armed is mapped to Away

## Usage
Now that we have connected the Pi to Jablotron and our Homekit we can start to control Jablotron via Homekit but also automate it.

The current setup of Jablotron as an Alarm System in Homekit requires user authentication when executing automations. For example when the first person arrives home, turn the alarm off. This will prompt a notification on your iOS device or watch asking if you want to execute this command.

This works every time and has the added benefit of being more secure, alternatively it is possible to make the Jablotron alarm appear as a switch and then the automation will work without confirmation.

If you want to use Siri for controlling the alarm, you need to create a scene, which switches the alarm on or off and then ask Siri to set that scene.

## Identify Jablotron services and devices

In Homebridge, under the Jablotron plugin > advanced settings. Enable Debug, this will start printing all sections, PGM devices and thermometers to the log including
their IDs. You can then use these IDs to configure your Homebridge config.

## Troubleshooting
- Jablontron cloud services require users' input to agree with its terms. Without confirmed agreement with these terms Jablotron Homebridge plugin won't work and will show Service Unavailable in the logs. To agree with Jablotron cloud terms sign into [MyJablotron](https://www.jablonet.net) using account configured for the plugin and the agreement comes up as first screen - click `I Agree` and the plugin starts working again
