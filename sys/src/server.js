//
// server
//
let cfg;
let filebrowser;
let privkey;
let certificate;
let bytes;
let originalSize;
let usbcfg;
let serial;
let firmVers;

const path = require('path');
const express = require('express');
const fs = require('fs');
const pwsys = require('./password');
const crypto = require('crypto');
const os = require('os');
const mime = require('mime-types');
const https = require('https');

let usb; // not cross platform
if (os.platform() === 'linux') {
    usb = require('usb-detection.linux');
} else if (os.platform() === 'darwin') {
    usb = require('usb-detection.darwin');
} else {
    usb = require('usb-detection.win32');
}

let _uuid = null;
let _agent = null;

const app = express();

exports.readUSBThenStart = function () {
    return usb.find().then(devices => scanDevices(devices));
};

function scanDevices(devices) {
    for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        if (cfg.validVendors.includes(device.vendorId.toString(16))) {
            usbcfg = {
                vid: device.vendorId.toString(16),
                pid: device.productId.toString(16),
                mfg: 0, // unsupported
                prod: 0, // unsupported
                serial: 0, // unsupported
                descString1: '', // device.manufacturer, // not cross-platform
                descString2: '', // device.deviceName, // not cross-platform
                descString3: device.serialNumber,
            };

            serial = pwsys.getSerial(usbcfg, cfg);
            firmVers = pwsys.getVersion(usbcfg, cfg);
            // console.log('serial : ' + serial);
            // console.log('vers   : ' + firmVers);

            startServer();

            break;
        }
    }
}

function isValid(av) {
    const [req, res] = av;

    // no valid device present, exit.
    if (usbcfg == null) {
        throw new Error('No valid USB device present');
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

app.get('/status', (req, res) => {
    const valid = isValid([req, res]);
    if (res.headersSent) {
        // already responded with "unauthorized"
        return;
    }

    if (!valid) {
        res.json({
            running: false,
            status: 'blocked',
        });
    } else {
        res.json({
            running: true,
            status: 'running',
        });
    }
});


function decrypt(key, fname, type, bytestart, byteendp, res) {
    try {
        const decipher = crypto.createDecipher(
            'aes-192-ofb',
            pwsys.makePassword(serial, firmVers, cfg.salt, key, bytes),
        );
        const fstat = fs.statSync(fname);
        const input = fs.createReadStream(fname);
        const hdr = {
            'Content-Type': type,
        };
        let finished = false;

        const streamError = (e) => {
            finished = true;
            if (res.headersSent) {
                console.log(e);
                res.end();
            } else {
                res.sendStatus(500);
            }
        };
        decipher.on('error', streamError);
        input.on('error', streamError);

        // items over 64k in size have their original lengths cached.
        const base = path.basename(fname);
        if ((bytestart != null) &&
            (fstat.size > 64 * 1024) &&
            (base in originalSize)) {
            // console.log("starting chunk at " + bytestart);
            const readSync = new Promise((resolve) => {
                const dec = input.pipe(decipher).pause();
                let byteend;

                if (byteendp == null) {
                    byteend = originalSize[base] - 1;
                } else {
                    byteend = byteendp;
                }

                const len = (byteend - bytestart) + 1;
                hdr['Accept-Ranges'] = 'bytes';
                hdr['Content-Length'] = len;
                hdr['Content-Range'] =
                    'bytes ' + bytestart +
                    '-' + byteend + '/' +
                    originalSize[base];
                res.writeHead(206, hdr);

                // console.log("reading to " + bytestart);

                // seek to the position in the file
                let count = 0;
                dec.on('readable', () => {
                    if (finished) {
                        return;
                    }

                    let lastchunk;
                    while ((lastchunk = dec.read()) !== null) {
                        const lenidx = lastchunk.length - 1;

                        // console.log("count = " + count);
                        if (count + lenidx > bytestart) {
                            let a = bytestart - count;
                            if (a < 0) a = 0;

                            const b = byteend - count;

                            // console.log("a = " + a);
                            // console.log("b = " + b);

                            if (b > lenidx) {
                                if (a == 0) {
                                    // send whole chunk
                                    res.write(lastchunk);
                                } else {
                                    res.write(lastchunk.slice(a));
                                }
                            } else {
                                // send the last slice, and done.
                                res.write(lastchunk.slice(a, b + 1));

                                input.destroy(); // flush
                                dec.destroy();
                                resolve();
                                break;
                            }
                        }

                        count += lastchunk.length;
                    }
                });
            });

            readSync.then(() => {
                res.end();
                finished = true;
            });
        } else {
            res.set(hdr);
            input.pipe(decipher).pipe(res);
        }
    } catch (err) {
        // console.log('DECRYPT ERROR: ' + err);
        res.sendStatus(404);
    }
}

exports.configure = function (locator) {
    cfg = require(path.join(locator.shared, 'usbcopypro.json'));

    if (cfg.fileBrowserEnabled) {
        filebrowser = require('file-browser');
    }

    // load keyfiles for SSL
    privkey = fs.readFileSync(path.join(locator.shared, 'cert', 'key.pem'), 'utf8');
    certificate = fs.readFileSync(path.join(locator.shared, 'cert', 'cert.pem'), 'utf8');

    // Get the random bytes buffer used for encryption.  This /could/
    // also be encrypted, but it would be trivially easy to get the secret
    // to decrypt it, so why?
    bytes = fs.readFileSync(path.join(locator.shared, 'bytes.dat'));

    originalSize = require(path.join(locator.shared, 'size.json'));

    // get drive info
    const contentDir = path.join(locator.shared, 'content.asar');

    if (cfg.fileBrowserEnabled) {
        app.use(express.static(filebrowser.moduleroot));
        filebrowser.setcwd(contentDir);
        app.get('/files', filebrowser.get);
        app.get('/', (req, res) => {
            if (!isValid([req, res])) { return; }
            res.redirect('lib/template.html');
        });

        const options = {
            root: contentDir,
        };

        app.get('/b', (req, res) => {
            if (!isValid([req, res])) { return; }
            const file = req.query.f;
            const match = file.match(/\.([^.]*)\.lock$/);
            if (match) {
                const fname = path.join(contentDir, file);
                const type = mime.lookup(match[1]);
                const key = req.get('x-api-key');
                decrypt(key, fname, type, null, null, res);
            } else {
                res.sendFile(file, options, (err) => {
                    if (err) {
                        // console.log('sendFile ERROR: ' + err);
                    }
                });
            }
        });
    } else {
        // detect *.lock files, and decrypt if needed
        app.use((req, res) => {
            if (!isValid([req, res])) { return; }

            const file = decodeURI(req.path);
            const encfile = path.join(contentDir, file + '.lock');

            if (fs.existsSync(encfile)) {
                const match = encfile.match(/\.([^.]*)\.lock$/);
                if (match) {
                    const type = mime.lookup(match[1]);
                    const key = req.get('x-api-key');
                    const bytestartHdr = req.get('range');
                    let bytestart = null;
                    let byteend = null;
                    if (bytestartHdr) {
                        const parts = bytestartHdr
                            .replace(/bytes=/, '')
                            .split('-');
                        bytestart = parseInt(parts[0], 10);
                        if (parts[1]) {
                            byteend = parseInt(parts[1], 10);
                        }
                        // console.log("got range, start = " + bytestart);
                    }
                    decrypt(key, encfile, type, bytestart, byteend, res);
                }
            } else {
                const nfile = path.join(contentDir, file);

                if (fs.existsSync(nfile)) {
                    // lockfile not found, return standard file fetch
                    res.sendFile(file, { root: contentDir }, (err) => {
                        if (err) {
                            // console.log('sendFile (static) ERROR: ' + err);
                        }
                    });
                } else {
                    res.sendStatus(404);
                }
            }
        });
    }
};

function startServer() {
    const server = https.createServer({
        key: privkey,
        cert: certificate,
        passphrase: serial,
    }, app);

    // Prevent ERR_CONTENT_LENGTH_MISMATCH errors, see:
    // https://github.com/expressjs/express/issues/3392#issuecomment-325681174
    server.keepAliveTimeout = 60000 * 15; // assume 15 minutes max, no real harm if the media/video are longer ...

    server.listen(cfg.SERVER_PORT, '127.0.0.1', (err) => {
        if (err) {
            // console.log('ERROR starting server: ' + err);
        }
    });
}

exports.lockSession = function (uuid, agent) {
    _uuid = uuid;
    _agent = agent;
};
