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

const fileStatCache = {};
let pwCache;
const reqThrottle = {
    available: true,
    res: null,
};

const path = require('path');
const express = require('express');
const fs = require('fs');
const pwsys = require('./password');
const crypto = require('crypto');
const os = require('os');
const mime = require('mime-types');
const https = require('https');

let lastmod;

let usb; // not cross platform
if (os.platform() === 'linux') {
    usb = require('usb-detection.linux'); // eslint-disable-line global-require
} else if (os.platform() === 'darwin') {
    usb = require('usb-detection.darwin'); // eslint-disable-line global-require
} else {
    usb = require('usb-detection.win32'); // eslint-disable-line global-require
}

let gUuid = null;
let gAgent = null;

const app = express();
let server;

// dummy variable used to help keep the parent process alive.
exports.keepAlive = true;

function startServer() {
    server = https.createServer({
        key: privkey,
        cert: certificate,
        passphrase: serial,
    }, app);

    // Prevent ERR_CONTENT_LENGTH_MISMATCH errors, see:
    // https://github.com/expressjs/express/issues/3392#issuecomment-325681174
    // assume 15 minutes max, no real harm if the media/video are longer ...
    server.keepAliveTimeout = 60000 * 15;

    server.on('clientError',(err,socket)=>{
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n' + err);
    });

    server.listen(cfg.SERVER_PORT, '127.0.0.1', (err) => {
        if (err) {
            // console.log('ERROR starting server: ' + err);
        }
    });
}

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

function readUSBThenStart() {
    return usb.find().then(devices => scanDevices(devices));
}
exports.readUSBThenStart = readUSBThenStart;

function isValid(av) {
    const [req, res] = av;

    // no valid device present, exit.
    if (usbcfg == null) {
        throw new Error('No valid USB device present');
    }

    if (gUuid == null || gAgent == null) {
        // disallow connection if server not set up
        res.sendStatus(500);
        return false;
    }

    if (!(req.get('user-agent') === gAgent &&
          req.get('session-id') === gUuid)) {
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


function unmask(input, bytestart, res, req) {
    setImmediate(() => {
        let chunk;
        do {
            chunk = input.read();
            if (!chunk) break;
            const c =
                new Buffer.alloc(chunk.length); // eslint-disable-line new-cap
            let j = bytestart % pwCache.length;
            for (let i = 0; i < chunk.length; i++) {
                c[i] = chunk[i] ^ pwCache[j]; // eslint-disable-line
                j = (j + 1) % pwCache.length;
            }
            res.write(c);
        } while (!req.finished);
    });
}

function decrypt(key, fname, type, bytestart, byteendp, res, req, input) {
    try {
        if (pwCache === undefined) {
            pwCache = pwsys.makePassword(
                serial, firmVers,
                cfg.salt, key, bytes,
            );
        }

        const hdr = {
            'Content-Type': type,
        };
        req.finished = false;

        req.on('close', () => {
            req.finished = true;
        });

        req.on('abort', () => {
            req.finished = true;
        });

        const streamError = () => {
            req.finished = true;
            if (res.headersSent) {
                res.end();
            } else {
                res.sendStatus(500);
            }
        };
        input.on('error', streamError);

        input.on('end', () => {
            req.finished = true;
            res.end();
        });

        // items over 64k in size have their original lengths cached.
        const base = path.basename(fname);
        if (base in originalSize) {
            // used mask, no encrypt
            if (bytestart != null) {
                // streaming
                let byteend;

                if (byteendp == null) {
                    byteend = originalSize[base] - 1;
                } else {
                    byteend = byteendp;
                }

                const len = (byteend - bytestart) + 1;
                hdr['Last-Modified'] = lastmod;
                hdr['Accept-Ranges'] = 'bytes';
                hdr['Content-Length'] = len;
                hdr['Content-Range'] =
                    'bytes ' + bytestart +
                    '-' + byteend + '/' +
                    originalSize[base];
                res.writeHead(206, hdr);
            } else {
                res.set(hdr);
            }

            input.on('readable', () => unmask(input, bytestart, res, req));
        } else {
            // decrypt, no streaming
            const decipher = crypto.createDecipher('aes-192-ofb', pwCache);
            decipher.on('error', streamError);
            res.set(hdr);
            input.pipe(decipher).pipe(res);
        }
    } catch (err) {
        res.sendStatus(404);
    }
}

function openAndCreateStream(fname, phwm, bytestart, byteend) {
    return new Promise((resolve) => {
        let nbe = byteend;
        if (nbe === null) {
            nbe = undefined;
        }
        fs.open(fname, 'r', 0o666, (err, nfd) => {
            let hwm = phwm;
            if (typeof hwm === 'undefined') hwm = 4 * 1024;
            const input = fs.createReadStream(fname, {
                fd: nfd,
                highWaterMark: hwm,
                start: bytestart,
                end: nbe,
            });
            resolve(input);
        });
    });
}

function configure(locator) {
    // TODO: this shouldn't be a global require
    cfg = require(path.join(locator.shared, 'usbcopypro.json')); // eslint-disable-line global-require,import/no-dynamic-require

    if (cfg.fileBrowserEnabled) {
        filebrowser = require('file-browser'); // eslint-disable-line global-require
    }

    // load keyfiles for SSL
    privkey = fs.readFileSync(path.join(locator.shared, 'cert', 'key.pem'), 'utf8');
    certificate = fs.readFileSync(path.join(locator.shared, 'cert', 'cert.pem'), 'utf8');

    // Get the random bytes buffer used for encryption.  This /could/
    // also be encrypted, but it would be trivially easy to get the secret
    // to decrypt it, so why?
    bytes = fs.readFileSync(path.join(locator.shared, 'bytes.dat'));

    // TODO: this shouldn't be a global require
    originalSize = require(path.join(locator.shared, 'size.json')); // eslint-disable-line global-require,import/no-dynamic-require

    // get drive info
    const contentDir = path.join(locator.shared, 'content.asar');

    lastmod = fs.statSync(path.join(locator.shared, 'size.json')).mtime;

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

            if (fileStatCache[encfile] === undefined) {
                fileStatCache[encfile] = fs.existsSync(encfile);
            }

            if (fileStatCache[encfile]) {
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
                        // console.log('got range, start:' + bytestart +
                        //             ' end:' + byteend);

                        // Don't hammer the streaming system with requests.
                        // BUT use the last one made.  This seems to fit
                        // with the behavior of video.js, especially when
                        // seeking.
                        if (reqThrottle.res !== null &&
                            !reqThrottle.res.headersSent) {
                            reqThrottle.res.sendStatus(503);
                        }
                        reqThrottle.encfile = encfile;
                        reqThrottle.res = res;
                        reqThrottle.req = req;
                        reqThrottle.bytestart = bytestart;
                        reqThrottle.byteend = byteend;
                        reqThrottle.type = type;

                        if (reqThrottle.available) {
                            reqThrottle.available = false;
                            setTimeout(
                                () => {
                                    // console.log('calling decrypt, key:' +
                                    //             key);
                                    reqThrottle.available = true;
                                    const hwm = 4 * 1024;

                                    // if we're starting from the beginning,
                                    // only buffer a little, but if we're
                                    // seeking, buffer a lot.
                                    openAndCreateStream(
                                        reqThrottle.encfile,
                                        hwm,
                                        reqThrottle.bytestart,
                                        reqThrottle.byteend,
                                    ).then((input) => {
                                        decrypt(
                                            key,
                                            reqThrottle.encfile,
                                            reqThrottle.type,
                                            reqThrottle.bytestart,
                                            reqThrottle.byteend,
                                            reqThrottle.res,
                                            reqThrottle.req,
                                            input,
                                        );
                                    }).catch(() => {
                                        // should probably do something here
                                    });
                                },
                                333,
                            );
                        } else {
                            // Assume this is one of the undetectable
                            // "cancelled" streaming requests made by
                            // the browser.  Not much we can do here.
                            // console.log("THROTTLE");
                        }
                    } else {
                        openAndCreateStream(encfile)
                        .then((input) => {
                            decrypt(
                                key, encfile, type,
                                bytestart, byteend,
                                res, req, input,
                            );
                        }).catch(() => {
                            // should probably do something here
                        });
                    }
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
}
exports.configure = configure;

function lockSession(uuid, agent) {
    gUuid = uuid;
    gAgent = agent;
}
exports.lockSession = lockSession;
