#!/usr/bin/env node

var usb = require('usb-detection');
var cfg = require(process.argv[2]);  // NOTE: relative to script location
var pwsys = require('../../src/password');

usb.find().then((devices) => {
    for (let i=0; i < devices.length; i++) {
        let device = devices[i];
        if (cfg.validVendors.includes(
                device.vendorId.toString(16)))
        {
            usbcfg = {
                "vid": device.vendorId.toString(16),
                "pid": device.productId.toString(16),
                "mfg": 1, // unsupported
                "prod": 2, // unsupported
                "serial": 3, // unsupported
                "descString1": "", // device.manufacturer, // not cross-platform
                "descString2": "", // device.deviceName, // not cross-platform
                "descString3": device.serialNumber
            };

            serial = pwsys.getSerial(usbcfg, cfg);
            firmVers = pwsys.getVersion(usbcfg, cfg);
            console.log('serial : ' + serial);
            console.log('vers   : ' + firmVers);

            break;
        }
    }
});
