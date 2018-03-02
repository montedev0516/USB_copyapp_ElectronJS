//
// server
//
var cfg = require('./config.json');

const path = require('path');
const express = require('express');
const fs = require('fs');
const pwsys = require('./password');
const crypto = require('crypto');
const os = require('os');
const mime = require('mime-types');
const https = require('https');

var filebrowser;
if (cfg.fileBrowserEnabled) {
    filebrowser = require('file-browser');
}

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

// load keyfiles for SSL
var privkey = fs.readFileSync(
    path.join(__dirname, '../cert/key.pem'), 'utf8');
var certificate = fs.readFileSync(
    path.join(__dirname, '../cert/cert.pem'), 'utf8');

// Get the random bytes buffer used for encryption.  This /could/
// also be encrypted, but it would be trivially easy to get the secret
// to decrypt it, so why?
var bytes = fs.readFileSync(path.join(__dirname, '../bytes.dat'));

// get drive info
var usbcfg = null;
var serial = null;
var firmVers = null;

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
            //console.log('serial : ' + serial);
            //console.log('vers   : ' + firmVers);

            startServer();

            break;
        }
    }
});

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
}

var contentDir = path.join(__dirname, '../content.asar');

app.get('/x', function(req, res) {
    if (!isValid([req, res])) { return; }

    let fname = path.join(contentDir, req.query.f); // TODO now: sanitize this filename
    let type = req.query.t;
    let key = req.get('x-api-key');

    decrypt(key, fname, type, res);
});

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

        fs.stat(encfile, (err, stats) => {
            let match = encfile.match(/\.([^.]*)\.lock$/);
            if ((err == null) && match) {
                let type = mime.lookup(match[1]);
                let key = req.get('x-api-key');
                decrypt(key, encfile, type, res);
            } else {
                // standard file fetch
                res.sendFile(file, {root: contentDir}, (err) => {
                    if (err) {
                        console.log('sendFile (static) ERROR: ' + err);
                        res.sendStatus(404);
                    }
                });
            }
        });
    });
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

exports.lockSession = (uuid, agent) => {
    _uuid = uuid;
    _agent = agent;
};
