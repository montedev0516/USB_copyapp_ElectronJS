
const crypto = require('crypto');
const fs = require('fs');
const pwsys = require('./password');
const path = require('path');
const asar = require('asar');
const { exec } = require('child_process');
const srvcfg = require('./config.json');
const stream = require('stream');

const sizes = {};

let bytes;

function main(enccfg, _msgcb, enccb, unenccb, donecb) {
    let msgcb = _msgcb;
    if (!msgcb) msgcb = () => { };

    // save serial length
    srvcfg.serialLength = enccfg.descString3.length;
    // save vid search list (currently always length 1)
    srvcfg.validVendors = [enccfg.vid];
    msgcb('writing config file...');
    fs.writeFileSync(
        path.join(enccfg.outPath, 'usbcopypro.json'),
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
        const certout = path.join(enccfg.outPath, 'cert');
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

                if (donecb) donecb();
            }
        });
    }

    function makeAsar() {
        msgcb('writing file size information');
        fs.writeFileSync(
            path.join(enccfg.outPath, 'size.json'),
            JSON.stringify(sizes),
        );

        const outfile = path.join(enccfg.outPath, 'content.asar');
        msgcb('creating asar file: ' + outfile);
        try {
            asar.createPackage(enccfg.workPath, outfile, () => {
                makeCertificate();
            });
        } catch (e) {
            msgcb('Exception!');
            msgcb(e, true);
        }
    }

    function go(idx, serial, vers, secret) {
        let file;
        const isEnc = !(serial.length === 0 &&
                      vers.length === 0 &&
                      secret.length === 0);
        if (isEnc) {
            if (idx >= encFiles.length) {
                if (enccb) enccb(idx, encFiles.length, true);

                // continue on to copy unencrypted files
                go(0, '', '', '');

                return;
            }
            file = encFiles[idx];
        } else {
            if (idx >= unencFiles.length) {
                if (unenccb) unenccb(idx, unencFiles.length, true);

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

        fnout = fnout.replace(enccfg.inPath, enccfg.workPath);

        // recursively create output dir
        const dir = path.dirname(fnout);
        function mkdirp(ndir) {
            const ppath = ndir.split(path.sep).slice(0, -1).join(path.sep);
            if (ppath.length !== 0 && !fs.existsSync(ppath)) {
                mkdirp(ppath);
            }
            fs.mkdirSync(ndir);
        }
        if (!fs.existsSync(dir)) {
            mkdirp(dir);
        }

        const fstat = fs.statSync(file);
        let useMask = false;
        if (fstat.size > 10 * 1024 * 1024) {
            sizes[path.basename(fnout)] = fstat.size;
            useMask = true;
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
            if (isEnc) {
                if (enccb) enccb(idx + 1, encFiles.length);
            } else if (unenccb) {
                unenccb(idx + 1, unencFiles.length);
            }
            // process next file
            go(idx + 1, serial, vers, secret, bytes);
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
            path.join(enccfg.outPath, 'bytes.dat'),
            bytes,
        );

        const kbuf = Buffer.from(enccfg.apiKey, 'hex');
        fs.writeFileSync(
            path.join(enccfg.outPath, '.hidfil.sys'),
            kbuf,
        );

        go(0, serial, vers, secret);
    }
}
module.exports = main;
