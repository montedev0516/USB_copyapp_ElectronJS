
const crypto = require('crypto');
const fs = require('original-fs');
const pwsys = require('./password');
const path = require('path');
const { exec } = require('child_process');
const stream = require('stream');
const disk = require('diskusage');

const sizes = {};

const serverconfig = {
   LAUNCH_URL: 'https://localhost:29500/index.html',
   SERVER_PORT: 29500,
   useDeviceSerialNum: false,
   fileBrowserEnabled: false,
   salt: 'c17155ee526f4ff9bad7d2623f5a26ad',
};

let bytes;

function main(enccfg, _msgcb, enccb, unenccb, donecb, checkSpaceCB) {
    let msgcb = _msgcb;
    if (!msgcb) msgcb = () => { };
    const outPath = path.join(enccfg.outPath, 'shared');

    try {
        fs.mkdirSync(outPath);
    } catch(error) {
        msgcb(error.toString(), true);
        return;
    }

    const srvcfg = {};
    Object.assign(srvcfg, serverconfig);

    // save serial length
    srvcfg.serialLength = enccfg.descString3.length;
    // save vid search list (currently always length 1)
    srvcfg.validVendors = [enccfg.vid];
    // save version
    srvcfg.version = enccfg.version;
    // save file browser enabled
    srvcfg.fileBrowserEnabled = enccfg.fileBrowserEnabled;

    msgcb('writing config file...');
    fs.writeFileSync(
        path.join(outPath, 'usbcopypro.json'),
        JSON.stringify(srvcfg),
    );

    // Compile file glob patterns into regexes.
    const excludeFiles = [];
    for (let i = 0; i < enccfg.filematch.length; i++) {
        // convert to regex
        excludeFiles.push('^' + enccfg.filematch[i]
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*') + '$');
    }

    // Run the filename through the matchers to determine if
    // it should be excluded.  The fname parameter is
    // the basename, no path.
    function includeFile(fname) {
        for (let i = 0; i < excludeFiles.length; i++) {
            if (fname.match(excludeFiles[i])) {
                return false;
            }
        }
        return true;
    }

    msgcb('Constructing File List...');

    // construct file list
    const dirs = [enccfg.inPath];
    const encFiles = [];
    const unencFiles = [];
    while (dirs.length > 0) {
        const dir = dirs.pop();
        const files = fs.readdirSync(dir);
        for (let i = 0; i < files.length; i++) {
            const pathname = path.join(dir, files[i]);
            const stat = fs.statSync(pathname);
            if (stat.isDirectory()) {
                dirs.push(pathname);
            } else if (includeFile(files[i])) {
                encFiles.push(pathname);
            } else {
                unencFiles.push(pathname);
            }
        }
    }

    function makeCertificate() {
        // There exist node modules to generate certificates, but
        // I could not find one that makes one protected by a passphrase.
        const cfg = path.join(__dirname, 'openssl.cnf');
        const certout = path.join(outPath, 'cert');
        const serial = pwsys.getSerial(enccfg, srvcfg);
        const script =
            'openssl req -x509 -newkey rsa:4096 -keyout "' + certout +
            path.sep + 'key.pem" ' +
            '-out "' + certout + path.sep +
            'cert.pem" -days 3650 -passout pass:' +
            serial + ' -config "' + cfg + '"';

        if (!fs.existsSync(certout)) {
            msgcb('Creating certificate dir: ' + certout);
            fs.mkdirSync(certout);
        }

        msgcb('Creating certificate in dir: ' + certout);
        exec(script, (error, stdout, stderr) => {
            if (error) {
                msgcb(error.toString(), true);
                msgcb(`openssl: ${stdout}`);
                msgcb(`openssl: ${stderr}`);
            } else {
                msgcb('Certificates generated');
                msgcb('Finished!');

                if (donecb) donecb(false);
            }
        });
    }

    function makeAsar() {
        // eslint-disable-next-line global-require
        const asar = require('asar');

        msgcb('writing file size information');
        fs.writeFileSync(
            path.join(outPath, 'size.json'),
            JSON.stringify(sizes),
        );

        const outfile = path.join(outPath, 'content.asar');
        msgcb('creating asar file: ' + outfile);
        try {
            asar.createPackage(
                enccfg.workPath,
                outfile,
                // next step: certificate
                (err) => {
                    if (err) {
                        msgcb(err, true);
                    } else {
                        asar.uncacheAll();
                        makeCertificate();
                    }
                },
            );
        } catch (e) {
            msgcb('Exception creating ASAR package!');
            msgcb(e, true);
        }
    }

    function checkSpace(checkSpaceCB2, outpath, dirType, spaceRequired, bytesRequired) {
        let ok = true;

        const dir = path.dirname(outpath);

        try {
            const info = disk.checkSync(dir);

            if (info.free < bytesRequired) {
                const message =
                    'There is less than ' + spaceRequired +
                    ' available in the ' + dirType +
                    ' directory, ' +
                    'what do you want to do?';

                ok = checkSpaceCB2(message);
            }
        } catch (err) {
            msgcb('Exception checking for disk space!');
            msgcb(err, true);
        }

        return ok;
    }

    function go(idx, serial, vers, secret) {
        let file;
        const isEnc = !(serial.length === 0 &&
                      vers.length === 0 &&
                      secret.length === 0);
        if (isEnc) {
            if (enccb) enccb(idx, encFiles.length);

            if (idx >= encFiles.length) {
                if (enccb) enccb(idx, encFiles.length, true);

                // continue on to copy unencrypted files
                go(0, '', '', '');

                return;
            }
            file = encFiles[idx];
        } else {
            if (unenccb) unenccb(idx, unencFiles.length);

            if (idx >= unencFiles.length) {
                if (unenccb) unenccb(idx, unencFiles.length, true);

                if (!checkSpace(checkSpaceCB, outPath, 'output', '3gb', 3221225472)) {
                    if (donecb) donecb(true);
                    return;
                }

                // package
                makeAsar();

                return;
            }
            file = unencFiles[idx];
        }

        let cipher;
        let fnout;
        if (isEnc) {
            cipher = crypto.createCipher('aes-192-ofb', secret);
            fnout = file + '.lock';
        } else {
            fnout = file;
        }

        const fstat = fs.statSync(file);
        let useMask = false;
        // Automatically allow streaming of certain files.
        // TODO: this list should be defined in the UI somehow.
        if (file.match(/\.mp4$/) || file.match(/\.m4v$/)) {
            useMask = true;
        }
        if (useMask || (fstat.size > 32 * 1024 * 1024)) {
            sizes[path.basename(fnout)] = fstat.size;
            useMask = true;
        }

        let dirType;

        // Large files are streamable and are not stored in the asar,
        // which has a hard-limit of 2Gb and seems to allocate
        // the entire file in memory.
        if (useMask) {
            // put masked files directly in output folder
            fnout = fnout.replace(
                enccfg.inPath,
                path.join(outPath, 'm'),
            );

            dirType = 'output';
        } else {
            // put encrypted files into working dir for asar creation
            fnout = fnout.replace(enccfg.inPath, enccfg.workPath);

            dirType = 'working';
        }

        // recursively create output dir
        const dir = path.dirname(fnout);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!checkSpace(checkSpaceCB, fnout, dirType, '10mb', 10485760)) {
            if (donecb) donecb(true);
            return;
        }

        const input = fs.createReadStream(file);
        const output = fs.createWriteStream(fnout);

        if (isEnc) {
            // Files over a certain size will be masked, not encrypted.
            // These are the only files available for streaming.
            if (useMask) {
                const filter = stream.Writable();
                filter._write = // eslint-disable-line no-underscore-dangle
                    (chunk, encoding, done) => {
                        const c =
                            new Buffer.alloc(chunk.length); // eslint-disable-line new-cap
                        let j = 0;
                        for (let i = 0; i < chunk.length; i++) {
                            c[i] = chunk[i] ^ secret[j]; // eslint-disable-line
                            j = (j + 1) % secret.length;
                        }
                        output.write(c);
                        done();
                    };

                input.pipe(filter);
            } else {
                input.pipe(cipher).pipe(output);
            }
        } else {
            input.pipe(output);
        }
        input.on('end', () => {
            output.end();

            if (isEnc) {
                if (enccb) enccb(idx + 1, encFiles.length);
            } else if (unenccb) {
                unenccb(idx + 1, unencFiles.length);
            }
            // process next file
            try {
                go(idx + 1, serial, vers, secret, bytes);
            } catch (e) {
                msgcb('Exception during encryption');
                msgcb(e, true);
            }
        });
    }

    if ((encFiles.length + unencFiles.length) > 0) {
        const serial = pwsys.getSerial(enccfg, srvcfg);
        const vers = pwsys.getVersion(enccfg, srvcfg);
        msgcb(serial + ' ' + vers + ' ' + enccfg.apiKey);

        const [b, secret] = pwsys.makeNewPassword(
            serial,
            vers,
            srvcfg.salt,
            enccfg.apiKey,
        );

        bytes = b;

        fs.writeFileSync(
            path.join(outPath, 'bytes.dat'),
            bytes,
        );

        const kbuf = Buffer.from(enccfg.apiKey, 'hex');
        fs.writeFileSync(
            path.join(outPath, '.hidfil.sys'),
            kbuf,
        );

        go(0, serial, vers, secret);
    }
}
module.exports = main;
