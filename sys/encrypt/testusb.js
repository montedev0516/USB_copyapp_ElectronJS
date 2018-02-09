#!/usr/bin/env node

var usb = require('usb');

var devices = usb.getDeviceList();

for (var d of devices) {
    if (d.deviceDescriptor.idVendor = 0x058f) { 
        let dd = d.deviceDescriptor;
        console.log('found at '+ d.busNumber + ':' + d.deviceAddress);
        console.log('----');
        console.log('found vid:pid \t= ' + 
                    dd.idVendor.toString(16) + ':' + dd.idProduct.toString(16));
        console.log('mfg:prd:ser   \t= ' + dd.iManufacturer + ':' + 
                    dd.iProduct + ':' + dd.iSerialNumber);

        var descs = [];
        d.open();

        function readDesc(idx) {
            return new Promise((resolve, reject) => {
                d.getStringDescriptor(idx, (err, data) => {
                    if (err) { 
                        console.log('err  ' + err);
                        throw err;
                    }
                    console.log('String ' + idx + '\t= ' + data);
                    descs[idx] = data;
                    resolve();
                });
            });
        }

        readDesc(1)
            .then(() => {return readDesc(2)})
            .then(() => {return readDesc(3)});

        break;
    }
}
