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
let drivePath;

// This is needed by es6-shim-server.js,
// in order to get the pre-compiled object so
// we can configure it.
require.main.server = exports;

const fileStatCache = {};
const nonSSLCache = {};
let pwCache;
const uuidv4 = require('uuid/v4');
const path = require('path');
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const mime = require('mime-types');
const https = require('https');
const log4js = require('log4js');
const { exec } = require('child_process');
const pwsys = require('./password');

const nonSSLBase =
    '/L2hvbWUvZGF2ZWsvd29yay91c2Ivc2VjdXJlLXVzYi1jb250ZW50Cg';

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
const nonSSLServer = express();
app.locals.title = 'USB Content System';
let server;

// dummy variable used to help keep the parent process alive.
exports.keepAlive = true;

// called if https server failed to start
function failStatus(req, res) {
    if (typeof serial === 'undefined') {
        res.json({
            running: false,
            status: 'blocked',
            serial: 'no drives found',
        });
        return;
    }

    const serialNo = serial.split(':').pop();
    res.json({
        running: false,
        status: 'blocked',
        serial: serialNo,
    });
}

function startServer() {
    try {
        if (typeof serial === 'undefined') {
            throw new Error('No drives found');
        }
        server = https.createServer({
            key: privkey,
            cert: certificate,
            passphrase: serial,
        }, app);
    } catch (err) {
        logger.error(err);
        logger.error('can\'t start server');
        // start a single-point server to show bad status
        server = express();
        server.get('/status', failStatus);
        server.listen(cfg.SERVER_PORT, '127.0.0.1');
        return;
    }

    // Prevent ERR_CONTENT_LENGTH_MISMATCH errors, see:
    // https://github.com/expressjs/express/issues/3392#issuecomment-325681174
    // assume 15 minutes max, no real harm if the media/video are longer ...
    server.keepAliveTimeout = 60000 * 15;

    server.on('clientError', (err, socket) => {
        logger.error('https client (ignored): ' + err);
        logger.error('https client socket read: ' + socket.bytesRead +
                     ' bytes');
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

    nonSSLServer.listen(cfg.SERVER_PORT + 1, '0.0.0.0', (err) => {
        logger.error('nonSSL server started');
        if (err) {
            logger.error(err);
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

function enctoolback(encdata) {
    const algorithm = 'aes-192-cbc';
    const encrypted = Buffer.from(encdata, 'hex');
    const password = process.env.ENCTOOLBACKPW;
    logger.info('salt:' + cfg.salt);
    const encpass = Buffer.from(password + 'dd' + cfg.salt, 'hex');

    const decipher = crypto.createDecipher(algorithm, encpass);
    let decrypted = decipher.update(encrypted);
    decrypted += decipher.final();
    const device = JSON.parse(decrypted.toString());

    logger.warn('WARNING: using received device data');
    logger.info(device);

    return device;
}

function scanDevices(devices) {
    serial = undefined;

    for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        logger.info('checking vendor: ' + device.vendorId.toString(16));
        if (isValidVendor(cfg.validVendors, device.vendorId.toString(16))) {
            logger.info('checking product: ' + device.productId.toString(16));
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
            logger.info('serial : ' + usbcfg.descString3);
            logger.info('vid    : ' + usbcfg.vid);
            logger.info('pid    : ' + usbcfg.pid);
            logger.info('vers   : ' + firmVers);

            devmon = device;

            // this can only execute once, so this eslint error
            // is a false positive
            // eslint-disable-next-line no-loop-func
            usb.on('remove:' + device.vendorId + ':' + device.productId, () => {
                logger.info('USB removed, closing application.');
                exports.keepAlive = false;
            });


            break;
        }
    }

    // always start the server, even it's the http one that says "failed"
    startServer();
}

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
            logger.debug('Server keepAliveProc ping: ' + app.locals.title);
            keepAliveProc();
        }, 750);
    } else {
        if (typeof usb !== 'undefined') {
            usb.stopMonitoring();
        }
        process.exit(0);
    }
}

// returns "true" if dev mode is detected.
function readUSBThenStart() {
    if (process.env.ENCTOOLBACK !== undefined) {
        // backdoor for the encryption tool to test data
        const encdevice = enctoolback(process.env.ENCTOOLBACK);
        if (encdevice) {
            const devices = [encdevice];
            scanDevices(devices);
            devmon = undefined;
            keepAliveProc();
            return true;
        }
    } else {
        usb.startMonitoring();
        usb.find().then((devices) => {
            scanDevices(devices);
            keepAliveProc();
        });
    }

    return false;
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

    if (typeof cfg.decryptLoaded === 'undefined') {
        // we haven't read the config file,
        // so we can't begin yet.
        res.sendStatus(503);
    }

    const serialNo = serial.split(':').pop();

    if (!valid) {
        res.json({
            running: false,
            status: 'blocked',
            serial: serialNo,
        });
    } else {
        res.json({
            running: true,
            status: 'running',
            serial: serialNo,
        });
    }
});


function unmask(input, bytestart, byteend, res, req) {
    if (typeof req === 'undefined') {
        logger.info('unmask returning: undefined request');
        return;
    }
    if (req.finished || bytestart > byteend) {
        logger.info('unmask closing: finished:' + req.finished + ' or ' +
                    bytestart + ' > ' + byteend);
        input.close();
        res.end();
        return;
    }

    const chunk = input.read();

    // The idea here for backpressure relief is we
    // first wait for the "drain" event, then attempt to
    // read the next chunk.  If that chunk is unavailable,
    // register the "readable" and "close" events.  If
    // we're at the end of file, then node will emit the
    // close event and finish the stream.
    if (!chunk) {
        input.once('readable', () => unmask(input, bytestart,
                                            byteend, res, req));
        return;
    }

    const c = Buffer.allocUnsafe(chunk.length);
    let j = bytestart % pwCache.length;
    for (let i = 0; i < chunk.length; i++) {
        c[i] = chunk[i] ^ pwCache[j]; // eslint-disable-line
        j = (j + 1) % pwCache.length;
    }
    const nl = bytestart + chunk.length;

    // only for debugging:
    // logger.info('unmask write ' + bytestart + ' <= ' + byteend +
    //             ' length:' + chunk.length);

    const didFlush = res.write(c);
    if (didFlush || res.writable) {
        input.once('readable', () => unmask(input, nl, byteend,
                                            res, req));
    } else {
        logger.info('Waiting for drain...');
        res.once('drain', () => unmask(input, nl,
                                       byteend, res, req));
    }
}

function decrypt(key, fname, type, bytestartp, byteendp,
                 response, request, inputStream) {
    const res = response;
    const req = request;
    const input = inputStream;
    try {
        if (typeof pwCache === 'undefined' &&
            serial && firmVers && key)
        {
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
            logger.info('stream closed ' + fname);
            req.finished = true;
            input.destroy();
        });

        req.on('abort', () => {
            logger.error('stream aborted ' + fname);
            req.finished = true;
        });

        const streamError = () => {
            logger.error('stream ERROR: ' + fname);
            if (res.headersSent) {
                res.end();
            } else {
                res.sendStatus(500);
            }
            req.finished = true;
        };
        input.on('error', streamError);
        res.on('error', streamError);

        // large items have their original lengths cached.
        const base = path.basename(fname);
        if (base in originalSize) {
            let byteend;
            let bytestart = bytestartp;
            // used mask, no encrypt
            if (bytestart != null) {
                // streaming

                if (byteendp == null) {
                    byteend = originalSize[base] - 1;
                } else {
                    byteend = byteendp;
                }

                const len = (byteend - bytestart) + 1;
                res.setHeader('Transfer-Encoding', 'chunked');
                hdr['Last-Modified'] = lastmod.toUTCString();
                hdr['Accept-Ranges'] = 'bytes';
                hdr['Content-Length'] = len;
                hdr['Content-Range'] =
                    'bytes ' + bytestart +
                    '-' + byteend + '/' +
                    originalSize[base];
                try {
                    res.writeHead(206, hdr);
                } catch (e) {
                    logger.error('Error writing headers!');
                    logger.info(e);
                }
            } else {
                bytestart = 0;
                byteend = originalSize[base] - 1;
                res.set(hdr);
            }

            input.once('readable', () => unmask(input, bytestart,
                                                byteend, res, req));
        } else {
            // decrypt, no streaming
            const decipher = crypto.createDecipher('aes-192-ofb', pwCache);
            decipher.on('error', streamError);
            res.set(hdr);

            // Using pipes does not seem to work here.  Need to
            // decrypt to memory first, then send the whole thing with
            // the proper length.

            input.on('readable', () => {
                let data = input.read();
                while (data) {
                    decipher.write(data);
                    data = input.read();
                }
            });
            input.on('close', () => {
                decipher.end();
            });

            const allData = [];
            decipher.on('readable', () => {
                let data = decipher.read();
                while (data) {
                    allData.push(data);
                    data = decipher.read();
                }
            });
            decipher.on('end', () => {
                const allDataBuf = Buffer.concat(allData);
                logger.info('pipe complete: ' + fname);
                logger.info('data size: ' + allDataBuf.length);
                res.send(allDataBuf);
            });
        }
    } catch (err) {
        logger.error('Decryption ERROR:');
        logger.error(err);
        if (res && !res.headersSent) {
            res.sendStatus(404);
        }
        throw new Error(err);
    }
}

function openAndCreateStream(fname, bytestart, byteend) {
    return new Promise((resolve, reject) => {
        let nbe = byteend;
        if (nbe === null) {
            nbe = undefined;
        }
        fs.open(fname, 'r', 0o666, (err, nfd) => {
            if (err) {
                reject(err);
                return;
            }

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

        // if we're starting from the beginning,
        // only buffer a little, but if we're
        // seeking, buffer a lot.
        openAndCreateStream(
            encfile,
            bytestart,
            byteend,
        ).then((input) => {
            decrypt(
                key,
                encfile,
                type,
                bytestart,
                byteend,
                res,
                req,
                input,
            );
        }).catch((e) => {
            logger.error(
                'openAndCreateStream error (stream): ' + e,
            );
            res.sendStatus(500);
        });
    } else {
        openAndCreateStream(encfile)
        .then((input) => {
            decrypt(
                key, encfile, type,
                bytestart, byteend,
                res, req, input,
            );
        }).catch((e) => {
            logger.error('openAndCreateStream error (nonstream): ' + e);
            res.sendStatus(500);
        });
    }
}

function processFileRequest(req, res, contentDir, locator, urlPath) {
  const file = urlPath;
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
    } else {
      res.sendStatus(500);
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
          // This happens if the request is aborted.
          logger.error('sendFile error: ' + err);
        }
      });
    } else {
      logger.error('File not found: ' + nfile);
      res.sendStatus(404);
    }
  }
}

function configure(locator) {
    const cfgpath = path.join(locator.shared, 'usbcopypro.json');
    cfg = JSON.parse(fs.readFileSync(cfgpath));
    drivePath = locator.drive;

    if (typeof locator.logging !== 'undefined') {
        log4js.configure({
            appenders: {
                logs: {
                    type: 'file',
                    filename: path.join(locator.logging, 'ucp-server.log'),
                },
            },
            categories: {
                server: { appenders: ['logs'], level: 'trace' },
                default: { appenders: ['logs'], level: 'trace' },
            },
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
          try {
            if (!isValid([req, res])) { return; }
            const file = decodeURI(req.path);
            processFileRequest(req, res, contentDir, locator, file);
          } catch (e) {
            logger.error('System exception: ' + e);
            res.sendStatus(404);
          }
        });

        app.use((err, req, res) => {
            logger.error('Middleware error: ' + err);
            res.sendStatus(500);
        });

        nonSSLServer.get(`${nonSSLBase}/:id`, (req, res) => {
            if (typeof cfg.castBinary === 'undefined') {
                res.sendStatus(500);
            }

            logger.info(`non-SSL: ${req.path}`);
            logger.info(`non-SSL: ${JSON.stringify(req.params)}`);
            const file = decodeURI(req.path);
            logger.info(`non-SSL: req.path=${file}`);
            const urlPathKey = file.replace(nonSSLBase, '');
            logger.info(`non-SSL: urlPathKey=${urlPathKey}`);
            const urlPath = nonSSLCache[urlPathKey];
            if (urlPath) {
                logger.info(`non-SSL: path=${urlPath}`);
                processFileRequest(req, res, contentDir, locator, urlPath);
            } else {
                logger.error(`non-SSL: path key not found ${urlPathKey}`);
                res.sendStatus(404);
            }
        });
    }
    cfg.decryptLoaded = true;
}
exports.configure = configure;

function lockSession(uuid, agent) {
    gUuid = uuid;
    gAgent = agent;
}
exports.lockSession = lockSession;

// Returns first local-ish address
// NOTE: the ipString is the starting
// characters of the string-ified representation
// of the IPv4 address.  It does not do real netmasking.
function getLocalIP(ipString) {
    const ifs = os.networkInterfaces();
    let addr = '';
    const ifNames = Object.keys(ifs);
    for (let i = 0; i < ifNames.length && !addr; i++) {
        const nets = ifs[ifNames[i]];
        for (let j = 0; j < nets.length && !addr; j++) {
            const nif = nets[j];
            logger.info(`local ip: ${nif.address}`);
            if (nif.family === 'IPv4' &&
                !nif.internal &&
                nif.address.startsWith(ipString))
            {
                addr = nif.address;
            }
        }
    }
    return addr;
}

function enableCastPath(targetPath) {
    const castId = uuidv4();
    nonSSLCache[`/${castId}`] = targetPath;
    logger.info(`startCast: set up cast ID: ${castId}`);
    return castId;
}
function startCast(uid, castUUID, castIP) {
    if (typeof cfg.castBinary === 'undefined') {
        logger.info('startCast: warning, castBinary is not enabled');
        return;
    }
    const castPath = path.join(drivePath, cfg.castBinary);
    if (!fs.existsSync(castPath)) {
        logger.error(`startCast: can't find cast binary ${castPath}`);
        throw new Error('cannot find cast binary');
    }
    if (!castUUID) {
        throw new Error('castUUID must be defined');
    }
    if (!castIP) {
        throw new Error('castIP must be defined');
    }

    logger.info(`startCast: found cast binary ${castPath}`);

    const network = castIP
        .split('.')
        .slice(0, 3)
        .reduce((s, n) => s + `${n}.`, '');

    const ip = getLocalIP(network);
    const port = cfg.SERVER_PORT + 1;

    if (!ip) {
        throw new Error(`cannot find local IP on network ${network}`);
    }

    const castUrl = `http://${ip}:${port}${nonSSLBase}/${uid}`;
    logger.info(`startCast: url -> ${castUrl}`);
    logger.info(`startCast: uuid ${castUUID}`);

    const execStr = `${castPath} -u ${castUUID} load ${castUrl}`;
    logger.info(`startCast: executing ${execStr}`);
    exec(execStr, (error, stdout, stderr) => {
        if (error) {
            logger.error('startCast EXEC: ERROR (error)');
            logger.error(error);
            throw new Error(error);
        }
        if (stderr) {
            logger.error('startCast EXEC: ERROR (stderr)');
            logger.error(stderr);
            throw new Error('exec FAILED: ' + stderr);
        }
        logger.info('startCast: process complete');
        logger.info(stdout);
    });
}
function parseGoChromecastOutput(output) {
    const lines = output.split(/\r\n|\r|\n/);
    logger.info(`got ${lines.length} lines`);

    const nameRE = /device_name="([^"]+)"/;
    const addrRE = /address="([^"]+)"/;
    const uuidRE = /uuid="([^"]+)"/;

    const results = [];
    lines.forEach((line) => {
        if (!line) return;
        let match;
        const row = {};

        match = nameRE.exec(line);
        if (match && match[1]) {
            [, row.name] = match;
        }

        match = addrRE.exec(line);
        if (match && match[1]) {
            [, row.address] = match;
        }

        match = uuidRE.exec(line);
        if (match && match[1]) {
            [, row.uuid] = match;
        }
        if (row.name && row.address && row.uuid) {
            results.push(row);
        }
    });

    if (results.length === 0) {
        logger.warn('no chromecast devices found');
    }

    return results;
}
async function listCast() {
    if (typeof cfg.castBinary === 'undefined') {
        logger.info('listCast: warning, castBinary is not enabled');
        return [];
    }
    const castPath = path.join(drivePath, cfg.castBinary);
    if (!fs.existsSync(castPath)) {
        logger.error(`listCast: can't find cast binary ${castPath}`);
        throw new Error('cannot find cast binary');
    }

    const execStr = `${castPath} ls`;
    logger.info(`listCast: executing ${execStr}`);

    const output = await new Promise((resolve, reject) => {
        exec(execStr, (error, stdout, stderr) => {
            if (error) {
                logger.error('listCast EXEC: ERROR (error)');
                logger.error(error);
                throw new Error(error);
            }
            if (stderr) {
                logger.error('listCast EXEC: ERROR (stderr)');
                logger.error(stderr);
                reject(new Error('exec FAILED: ' + stderr));
                return;
            }
            resolve(stdout);
        });
    });
    logger.info('listCast output:');
    logger.info(output);

    return parseGoChromecastOutput(output);
}

async function sendMessage(msg) {
    if (typeof msg.startCast !== 'undefined') {
        let result = [];
        const { targetPath, castUUID, castIP } = msg.startCast;
        if (targetPath) {
            // start
            logger.info(`Got startCast start command: ${targetPath}`);
            const uid = enableCastPath(targetPath);
            startCast(uid, castUUID, castIP);
        } else {
            logger.info('Got startCast list command');
            // list
            result = await listCast();
        }
        return JSON.stringify(result);
    }

    return '';
}
exports.sendMessage = sendMessage;
