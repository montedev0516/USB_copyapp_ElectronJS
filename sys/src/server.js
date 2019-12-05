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

// This is needed by es6-shim-server.js,
// in order to get the pre-compiled object so
// we can configure it.
require.main.server = exports;

const fileStatCache = {};
let pwCache;
const reqThrottle = {
    available: true,
    res: null,
};

const path = require('path');
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const mime = require('mime-types');
const https = require('https');
const pwsys = require('./password');
const log4js = require('log4js');

let logger;

let lastmod;
let devmon;

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

    server.on('clientError', (err, socket) => {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n' + err);
        logger.error('https client: ' + err);
    });

    server.on('error', (e) => {
        logger.error('https server: ' + e);
    });

    process.on('SIGPIPE', () => {
        logger.warn('Warning: Ignoring SIGPIPE signal');
    });

    server.listen(cfg.SERVER_PORT, '127.0.0.1', (err) => {
        if (err) {
            logger.error('ERROR starting server: ' + err);
        } else {
            logger.info('Listening on ' + cfg.SERVER_PORT);
        }
    });
}

function zeroPad(value, size) {
    const s = '0000' + value.trim().toLowerCase();
    return s.substr(s.length - size);
}

function isValidVendor(validVendors, vendorId) {
    let valid = false;
    const vid = zeroPad(vendorId, 4);

    for (let i = 0; i < validVendors.length; i++) {
        if (zeroPad(validVendors[i], 4) === vid) {
            valid = true;
            break;
        }
    }

    return valid;
}

function scanDevices(devices) {
    for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        if (isValidVendor(cfg.validVendors, device.vendorId.toString(16))) {
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
            devmon = device;

            usb.on('remove:' + device.vendorId + ':' + device.productId, () => {
                logger.info('USB removed, closing application.');
                exports.keepAlive = false;
            });


            break;
        }
    }
}

function readUSBThenStart() {
    usb.startMonitoring();
    usb.find().then((devices) => {
        scanDevices(devices)
        keepAliveProc();
    });
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
    logger.debug('request /status valid=' + valid);
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
    if (req.finished) return;

    const chunk = input.read();

    // The idea here for backpressure relief is we
    // first wait for the "drain" event, then attempt to
    // read the next chunk.  If that chunk is unavailable,
    // register the "readable" and "close" events.  If
    // we're at the end of file, then node will emit the
    // close event and finish the stream.
    if (!chunk) {
        input.once('readable', () => unmask(input, bytestart, res, req));
        if (input.listenerCount('close') < 1) {
            input.once('close', () => res.end());
        }
        return;
    }

    const c = Buffer.allocUnsafe(chunk.length);
    let j = bytestart % pwCache.length;
    for (let i = 0; i < chunk.length; i++) {
        c[i] = chunk[i] ^ pwCache[j]; // eslint-disable-line
        j = (j + 1) % pwCache.length;
    }
    const nl = bytestart + chunk.length;
    const didFlush = res.write(c);
    if (didFlush) {
        input.once('readable', () => unmask(input, nl, res, req));
    } else {
        res.once('drain', () => unmask(input, nl, res, req));
    }
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
            input.destroy();
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

        // large items have their original lengths cached.
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
                hdr['Transfer-Encoding'] = 'chunked';
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

            res.flushHeaders();

            input.once('readable', () => unmask(input, bytestart, res, req));
        } else {
            // decrypt, no streaming
            const decipher = crypto.createDecipher('aes-192-ofb', pwCache);
            decipher.on('error', streamError);
            res.set(hdr);
            input.pipe(decipher).pipe(res);
        }
    } catch (err) {
        res.sendStatus(404);
        throw new Error(err);
    }
}

function openAndCreateStream(fname, bytestart, byteend) {
    return new Promise((resolve) => {
        let nbe = byteend;
        if (nbe === null) {
            nbe = undefined;
        }
        fs.open(fname, 'r', 0o666, (err, nfd) => {
            if (err) throw new Error(err);

            const input = fs.createReadStream(fname, {
                fd: nfd,
                start: bytestart,
                end: nbe,
            });
            resolve(input);
        });
    });
}

function streamFile(match, res, req, encfile) {
    const type = mime.lookup(match);
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
        logger.info('got range, start:' + bytestart +
                    ' end:' + byteend);

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

                    // if we're starting from the beginning,
                    // only buffer a little, but if we're
                    // seeking, buffer a lot.
                    openAndCreateStream(
                        reqThrottle.encfile,
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
                10,
            );
        } else {
            // Assume this is one of the undetectable
            // "cancelled" streaming requests made by
            // the browser.  Not much we can do here.
            logger.warning("Request was throttled");
        }
    } else {
        openAndCreateStream(encfile)
        .then((input) => {
            decrypt(
                key, encfile, type,
                bytestart, byteend,
                res, req, input,
            );
        }).catch((e) => {
            logger.error('Decryption error: ' + e);
        });
    }
}

function configure(locator) {
    // TODO: this shouldn't be a global require
    cfg = require(path.join(locator.shared, 'usbcopypro.json')); // eslint-disable-line global-require,import/no-dynamic-require

    if (typeof(locator.logging) !== 'undefined') {
        log4js.configure({
            appenders: {
                logs: {
                    type: 'file',
                    filename: path.join(locator.logging,'ucp-server.log'),
                },
            },
            categories: {
                server: { appenders: ['logs'], level: 'debug' },
                default: { appenders: ['logs'], level: 'debug' },
            }
        });
        logger = log4js.getLogger('server');
    } else {
        log4js.configure({
            appenders: { log: { type: 'stderr' } },
            categories: { default: { appenders: ['log'], level: 'error' } },
        });
        logger = log4js.getLogger();
    }

    logger.info('UCP Starting...');
    logger.debug('debug messages enabled');
    logger.info('info messagees enabled');
    logger.error('error messages enabled');

    if (cfg.fileBrowserEnabled) {
        filebrowser = require('file-browser'); // eslint-disable-line global-require
        filebrowser.configure({
            removeLockString: true,
            otherRoots: [path.join(locator.shared, 'm')],
        });
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
                let fname;
                if (path.basename(file) in originalSize) {
                    // large files are not stored in the asar
                    fname = path.join(locator.shared, 'm', file);
                } else {
                    fname = path.join(contentDir, file);
                }

                streamFile(match[1], res, req, fname);
            } else {
                res.sendFile(file, options, (err) => {
                    if (err) {
                        logger.error('sendFile ERROR: ' + err);
                    }
                });
            }
        });
    } else {
        // detect *.lock files, and decrypt if needed
        app.use((req, res) => {
            if (!isValid([req, res])) { return; }

            const file = decodeURI(req.path);
            let encfile = path.join(contentDir, file + '.lock');

            if (path.basename(encfile) in originalSize) {
                // large files are not stored in the asar
                encfile = path.join(locator.shared, 'm', file + '.lock');
            }

            if (fileStatCache[encfile] === undefined) {
                fileStatCache[encfile] = fs.existsSync(encfile);
            }

            if (fileStatCache[encfile]) {
                const match = encfile.match(/\.([^.]*)\.lock$/);
                if (match) {
                    streamFile(match[1], res, req, encfile);
                }
            } else {
                let nfile = encfile.replace('.lock', '');
                let cdir = contentDir;

                if (path.basename(nfile) in originalSize) {
                    // large files are not stored in the asar
                    cdir = path.join(locator.shared, 'm');
                    nfile = path.join(cdir, file);
                }

                if (fs.existsSync(nfile)) {
                    // lockfile not found, return standard file fetch
                    res.sendFile(file, { root: cdir }, (err) => {
                        if (err) {
                            // This happens if the request is aborted,
                            // no need to report.
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

function checkUSB() {
    if (devmon !== undefined) {
        usb.find(devmon.vendorId, devmon.productId, (err, devs) => {
            if (devs.length <= 0) {
                logger.info('USB device removed, exiting');
                exports.keepAlive = false;
            }
        });
    }
}

// Make sure that the USB device remains plugged in
// as long as the server is alive.
function keepAliveProc() {
    if (exports.keepAlive) {
        setTimeout(() => {
            checkUSB();
            keepAliveProc();
        }, 750);
    } else {
        if (typeof usb !== 'undefined') {
            usb.stopMonitoring();
        }
        process.exit(0);
    }
}
