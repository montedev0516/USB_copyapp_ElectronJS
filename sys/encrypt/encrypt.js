
const crypto = require('crypto');
const fs = require('fs');
const pwsys = require('../src/password');
const path = require('path');
const asar = require('asar');

const srvcfg = require('../src/config.json');

module.exports = function(enccfg, msgcb, enccb, unenccb) {
    if (!msgcb) msgcb = (s) => { console.log(s); }

    // Run the filename through the matchers to determine if
    // it should be included.  The fname parameter is
    // the basename, no path.
    function includeFile(fname) {
        for (let i = 0; i < enccfg.filematch.length; i++) {
            // convert to regex
            let regex = '^' + enccfg.filematch[i]
                .replace(/\./g,'\\.')
                .replace(/\*/g,'.*') + '$';
            if (fname.match(regex)) {
                return true;
            }
        }
        return false;
    }

    var doEncrypt = enccfg.encrypt;

    // construct file list
    let dirs = [enccfg.inputPath];
    let encFiles = [];
    let unencFiles = [];
    while(dirs.length > 0) {
        let dir = dirs.pop();
        let files = fs.readdirSync(dir);
        for (let i = 0; i < files.length; i++) {
            let pathname = path.join(dir,files[i]);
            let stat = fs.statSync(pathname);
            if (stat.isDirectory()) {
                dirs.push(pathname);
            } else {
                if (includeFile(files[i])) {
                    encFiles.push(pathname);
                } else {
                    unencFiles.push(pathname);
                }
            }
        }
    }

    function makeAsar() {
        let outfile = enccfg.outputPath + '.asar';
        msgcb('creating asar file: ' + outfile);
        asar.createPackage(enccfg.outputPath, outfile, () => {
            msgcb('Finished!');
        });
    }

    function go(idx, serial, vers, secret) {
        let file;
        let isEnc = !(serial.length == 0 && vers.length == 0 && secret.length == 0);
        if (isEnc) {
            if (idx >= encFiles.length) {
                if (enccb) enccb(idx, true);

                // continue on to copy unencrypted files
                go(0, '', '', '');

                return;
            }
            file = encFiles[idx];
        } else {
            if (idx >= unencFiles.length) {
                if (unenccb) unenccb(idx, true);

                // package
                makeAsar();

                return;
            }
            file = unencFiles[idx];
        }

        var cipher;
        var fnout;
        if (isEnc) {
            if (doEncrypt) {
                cipher = crypto.createCipher('aes-256-cbc', secret);
                fnout = file + '.lock';
            } else {
                cipher = crypto.createDecipher('aes-256-cbc', secret);
                fnout = file.replace('.lock','');
            }
        } else {
            fnout = file;
        }

        fnout = fnout.replace(enccfg.inputPath, enccfg.outputPath);

        // recursively create output dir
        let dir = path.dirname(fnout);
        function mkdirp(dir) {
            let ppath = dir.split(path.sep).slice(0,-1).join(path.sep);
            if (ppath.length != 0 && !fs.existsSync(ppath)) {
                mkdirp(ppath);
            }
            fs.mkdirSync(dir);
        }
        if (!fs.existsSync(dir)) {
            mkdirp(dir);
        }

        var input = fs.createReadStream(file);
        var output = fs.createWriteStream(fnout);

        if (isEnc) {
            input.pipe(cipher).pipe(output);
        } else {
            input.pipe(output);
        }
        input.on('end', () => {
            if (isEnc) {
                if (enccb) enccb(idx);
            } else {
                if (unenccb) unenccb(idx);
            }
            // process next file
            go(idx + 1, serial, vers, secret, bytes);
        });
    }

    if (encFiles.length > 0) {
        let serial = pwsys.getSerial(enccfg, srvcfg);
        let vers = pwsys.getVersion(enccfg, srvcfg);
        msgcb('serial: ' + serial);
        msgcb('vers  : ' + vers);
        msgcb('apikey: ' + enccfg.apiKey);

        var secret;
        if (doEncrypt) {
            var bytes;
            [bytes, secret] = pwsys.makeNewPassword(serial,
                                                    vers,
                                                    srvcfg.salt,
                                                    enccfg.apiKey);
            fs.writeFileSync('bytes.dat', bytes);

            var kbuf = Buffer.from(enccfg.apiKey, 'hex');
            fs.writeFileSync('.hidfil.sys', kbuf);
        } else {
            var kbuf = fs.readFileSync('.hidfil.sys');
            var apikey = kbuf.toString('hex');
            var bytes = fs.readFileSync('bytes.dat');

            msgcb('key   : ' + apikey);
            secret = pwsys.makePassword(serial,
                                        vers,
                                        srvcfg.salt,
                                        apikey,
                                        bytes);
        }

        go(0, serial, vers, secret);
    }

}
