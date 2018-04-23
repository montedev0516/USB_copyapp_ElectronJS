//
// server
//
var cfg;
var filebrowser;
var privkey;
var certificate;
var bytes;
var usbcfg;
var serial;
var firmVers;

const path = require('path');
const express = require('express');
const fs = require('fs');
const pwsys = require('./password');
const crypto = require('crypto');
const os = require('os');
const mime = require('mime-types');
const https = require('https');

var usb; // not cross platform
if (os.platform() === 'linux') {
    usb = require('usb-detection.linux');
} else if (os.platform() === 'darwin') {
    usb = require('usb-detection.darwin');
} else {
    usb = require('usb-detection.win32');
}

var _uuid = null;
var _agent = null;

var app = express();

exports.readUSBThenStart = function() {
    return usb.find().then(devices => scanDevices(devices));
}

function scanDevices(devices) {
    for (let i=0; i < devices.length; i++) {
        let device = devices[i];
        if (cfg.validVendors.includes(
                device.vendorId.toString(16)))
        {
            usbcfg = {
                "vid": device.vendorId.toString(16),
                "pid": device.productId.toString(16),
                "mfg": 0, // unsupported
                "prod": 0, // unsupported
                "serial": 0, // unsupported
                "descString1": "", // device.manufacturer, // not cross-platform
                "descString2": "", // device.deviceName, // not cross-platform
                "descString3": device.serialNumber
            };

            serial = pwsys.getSerial(usbcfg, cfg);
            firmVers = pwsys.getVersion(usbcfg, cfg);
            //console.log('serial : ' + serial);
            //console.log('vers   : ' + firmVers);

            startServer();

            break;
        }
    }
}

function isValid(av) {
    var [req, res] = av;

    // no valid device present, exit.
    if (usbcfg == null) {
        console.error("No valid USB device present");
        return false;
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
    let valid = isValid([req, res]);
    if (res.headersSent) {
        // already responded with "unauthorized"
        return;
    }

    if (!valid) {
        res.json({
            "running": false,
            "status": "blocked"
        });
    } else {
        res.json({
            "running": true,
            "status": "running"
        });
    }
});


function decrypt(key, fname, type, res) {
    try {
        let decipher = crypto.createDecipher(
            'aes-256-cbc',
            pwsys.makePassword(serial, firmVers, cfg.salt, key, bytes)
        );
        let input = fs.createReadStream(fname);
        res.set('Content-Type', type);
        input.pipe(decipher).pipe(res);
    } catch (err) {
        console.log('DECRYPT ERROR: ' + err);
        res.sendStatus(404);
    }
}

exports.configure = function(locator) {
    cfg = require(path.join(locator.shared, 'usbcopypro.json'));

    if (cfg.fileBrowserEnabled) {
        filebrowser = require('file-browser');
    }

    // load keyfiles for SSL
    privkey = fs.readFileSync(
        path.join(locator.shared, 'cert', 'key.pem'), 'utf8');
    certificate = fs.readFileSync(
        path.join(locator.shared, 'cert', 'cert.pem'), 'utf8');

    // Get the random bytes buffer used for encryption.  This /could/
    // also be encrypted, but it would be trivially easy to get the secret
    // to decrypt it, so why?
    bytes = fs.readFileSync(path.join(locator.shared, 'bytes.dat'));

    // get drive info
    var contentDir = path.join(locator.shared, 'content.asar');

    if (cfg.fileBrowserEnabled) {
        app.use(express.static(filebrowser.moduleroot));
        filebrowser.setcwd(contentDir);
        app.get('/files', filebrowser.get);
        app.get('/', (req, res) => {
            if (!isValid([req, res])) { return; }
            res.redirect('lib/template.html');
        });

        var options = {
            root: contentDir
        };

        app.get('/b', (req, res) => {
            if (!isValid([req, res])) { return; }
            let file = req.query.f;
            let match = file.match(/\.([^.]*)\.lock$/);
            if (match) {
                let fname = path.join(contentDir, file);
                let type = mime.lookup(match[1]);
                let key = req.get('x-api-key');
                decrypt(key, fname, type, res);
            } else {
                res.sendFile(file, options, (err) => {
                    if (err) {
                        console.log('sendFile ERROR: ' + err);
                    }
                });
            }
        });
    } else {
        // detect *.lock files, and decrypt if needed
        app.use((req, res) => {
            if (!isValid([req, res])) { return; }

            let file = decodeURI(req.path);
            let encfile = path.join(contentDir, file + '.lock');

            if (fs.existsSync(encfile)) {
                let match = encfile.match(/\.([^.]*)\.lock$/);
                if (match) {
                    let type = mime.lookup(match[1]);
                    let key = req.get('x-api-key');
                    decrypt(key, encfile, type, res);
                    return;
                }
            }

            // lockfile not found, return standard file fetch
            res.sendFile(file, {root: contentDir}, (err) => {
                if (err) {
                    console.log('sendFile (static) ERROR: ' + err);
                }
            });
        });
    }
}

function startServer() {
    var server = https.createServer({
        "key": privkey,
        "cert": certificate,
        "passphrase": serial
    }, app);

    server.listen(cfg.SERVER_PORT, '127.0.0.1', (err) => {
        if (err) {
            console.log('ERROR starting server: ' + err);
        }
    });
}

exports.lockSession = function(uuid, agent) {
    _uuid = uuid;
    _agent = agent;
};
