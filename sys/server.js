//
// server
//
var cfg = require('./config.json');

const path = require('path');
const express = require('express');
const fs = require('fs');
const pwsys = require('./src/password');
const crypto = require('crypto');
const os = require('os');

var filebrowser;
if (cfg.fileBrowserEnabled) {
    filebrowser = require('file-browser');
}

var usb; // not cross platform
if (os.platform() === 'linux') {
    usb = require('usb-detection.linux');
} else {
    usb = require('usb-detection.win32');
}

var _uuid = null;
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

usb.find().then((devices) => {
    for (device of devices) {
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
        }
    }
});

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

if (cfg.fileBrowserEnabled) {
    var contentDir = path.join(__dirname, 'content');

    app.use(express.static(filebrowser.moduleroot));
    filebrowser.setcwd(contentDir);
    app.get('/files', filebrowser.get);
    app.get('/', (req, res) => {
        res.redirect('lib/template.html');
    });

    var options = {
        root: contentDir
    };

    app.get('/b', (req, res) => {
        let file = req.query.f;
        res.sendFile(file, options, (err) => {
            if (err) {
                console.log('ERROR: ' + err);
            }
        });
    });

}

app.listen(cfg.SERVER_PORT, 'localhost', () => {
    console.log('Listening on ' + cfg.SERVER_PORT);
});

exports.lockSession = (uuid, agent) => {
    _uuid = uuid;
    _agent = agent;
};
