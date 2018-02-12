//
// server
//
var cfg = require('./config.json');

const express = require('express');
const fs = require('fs');
const pwsys = require('./src/password');
const crypto = require('crypto');
const usb = require('usb');

var _uuid = 'c02bb8c7-8cca-4805-9711-0545a471103f'; //null;
var _agent = null;

var app = express();

// Get the random bytes buffer used for encryption.  This /could/
// also be encrypted, but it would be trivially easy to get the secret
// to decrypt it, so why?
var bytes = fs.readFileSync('bytes.dat');

// get drive info
var usbcfg = null;
var serial = null;
var firmVers = null;
var devices = usb.getDeviceList();
for (var device of devices) {
    if (cfg.validVendors.includes(
            device.deviceDescriptor.idVendor.toString(16)))
    {
        var descs = [];
        function readDesc(idx) {
            return new Promise((resolve, reject) => {
                device.getStringDescriptor(idx, (err, data) => {
                    if (err) { throw err; }
                    descs[idx] = data;
                    resolve();
                });
            });
        }

        device.open();
        readDesc(1)
            .then(() => {return readDesc(2)})
            .then(() => {return readDesc(3)})
            .then(() => {
                let dd = device.deviceDescriptor;
                usbcfg = {
                    "vid": dd.idVendor.toString(16),
                    "pid": dd.idProduct.toString(16),
                    "mfg": dd.iManufacturer,
                    "prod": dd.iProduct,
                    "serial": dd.iSerialNumber,
                    "descString1": descs[1],
                    "descString2": descs[2],
                    "descString3": descs[3]
                };

                serial = pwsys.getSerial(usbcfg);
                firmVers = pwsys.getVersion(usbcfg);
                console.log('serial : ' + serial);
                console.log('vers   : ' + firmVers);
                return Promise.resolve();
            }).then(() => {device.close();})
        ;
        break; // need to break, so device doesn't get auto-closed
    }
}

function isValid(av) {
    [req, res] = av;

    // no valid device present, exit.
    if (usbcfg == null) {
        throw "No valid USB device present";
    }

    if (_uuid == null || _agent == null) {
        // disallow connection if server not set up
        res.sendStatus(500);
        return false;
    }

    if (!(req.get('user-agent') === _agent &&
          req.get('session-id') === _uuid)) {
        // disallow connection from external browser
        res.sendStatus(401);
        return false;
    }

    return true;
}

app.get('/status', function(req, res) {
    if (!isValid([req, res])) { return; }

    res.json({
        "running": true,
        "status": "running"
    });
});

app.get('/x', function(req, res) {
    if (!isValid([req, res])) { return; }

    let fname = './content/' + req.query.f; // TODO now: sanitize this filename
    let type = req.query.t;
    let key = req.get('x-api-key');
    console.log('decrypt: ' + fname);
    console.log('apikey : ' + key);
    fs.readFile(fname, (err, data) => {
        if (err) {
            console.log('READ ERROR: ' + err);
            res.sendStatus(404);
        } else {
            let decipher = crypto.createDecipher(
                'aes-256-cbc',
                pwsys.makePassword(serial, firmVers, cfg.salt, key, bytes)
            );

            try {
                let decrypted = Buffer.concat(
                    [decipher.update(data), decipher.final()]
                );

                res.set('Content-Type', type);
                res.send(decrypted);
            } catch (err) {
                console.log('DECRYPT ERROR: ' + err);
                res.sendStatus(404);
            }
        }
    });

});

app.listen(cfg.SERVER_PORT, () => {
    console.log('Listening on ' + cfg.SERVER_PORT);
});

exports.lockSession = (uuid, agent) => {
    _uuid = uuid;
    _agent = agent;
};
