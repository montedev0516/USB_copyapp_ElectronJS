
const crypto = require('crypto');
const fs = require('fs');
const pwsys = require('./password');
const path = require('path');
const asar = require('asar');
const { exec } = require('child_process');

const srvcfg = require('./config.json');

module.exports = function(enccfg, msgcb, enccb, unenccb) {
    if (!msgcb) msgcb = (s,e) => { console.log(s); }

    // save serial length
    srvcfg.serialLength = enccfg.descString3.length;
    // save vid search list (currently always length 1)
    srvcfg.validVendors = [enccfg.vid];
    msgcb('writing config file...');
    fs.writeFileSync(
        path.join(enccfg.workingPath,'usbcopypro.json'),
        JSON.stringify(srvcfg));

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

    msgcb("Constructing File List...");

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

    function makeCertificate() {
        // There exist node modules to generate certificates, but
        // I could not find one that makes one protected by a passphrase.
        let cfg = path.join(__dirname, 'openssl.cnf');
        let certout = path.join(enccfg.workingPath, 'cert');
        let serial = pwsys.getSerial(enccfg, srvcfg);
        let script =
            'openssl req -x509 -newkey rsa:4096 -keyout ' + certout +
            path.sep + 'key.pem ' +
            '-out ' + certout + path.sep +
            'cert.pem -days 3650 -passout pass:' +
            serial + ' ' + '-config ' + cfg;

        if (!fs.existsSync(certout)) {
            //console.log('creating dir: ' + certout);
            msgcb('Creating certificate dir: ' + certout);
            fs.mkdirSync(certout);
        }

        //console.log('making certificate: ' + script);
        msgcb('Creating certificate in dir: ' + certout);
        exec(script, (error, stdout, stderr) => {
            if (error) {
                console.error('exec error: ' + error);
                console.log(`openssl: ${stdout}`);
                console.log(`openssl: ${stderr}`);
                msgcb(error.toString(), true);
            } else {
                msgcb('Certificates generated');
                msgcb('Finished!');
            }
        });

    }

    function makeAsar() {
        let outfile = path.join(enccfg.workingPath, 'content.asar');
        msgcb('creating asar file: ' + outfile);
        //console.log('creating asar file: ' + outfile);
        try {
            asar.createPackage(enccfg.outputPath, outfile, () => {
                //console.log('DONE with asar package');
                makeCertificate();
            });
        } catch (e) {
            msgcb('Exception!');
            msgcb(e, true);
        }
    }

    function go(idx, serial, vers, secret) {
        let file;
        let isEnc = !(serial.length == 0 && vers.length == 0 && secret.length == 0);
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
                if (enccb) enccb(idx + 1, encFiles.length);
            } else {
                if (unenccb) unenccb(idx + 1, unencFiles.length);
            }
            // process next file
            go(idx + 1, serial, vers, secret, bytes);
        });
    }

    if ((encFiles.length + unencFiles.length) > 0) {
        let serial = pwsys.getSerial(enccfg, srvcfg);
        let vers = pwsys.getVersion(enccfg, srvcfg);
        msgcb(serial + ' ' + vers + ' ' + enccfg.apiKey);

        var secret;
        if (doEncrypt) {
            var bytes;
            [bytes, secret] = pwsys.makeNewPassword(serial,
                                                    vers,
                                                    srvcfg.salt,
                                                    enccfg.apiKey);
            fs.writeFileSync(
                path.join(enccfg.workingPath,'bytes.dat'),
                bytes);

            var kbuf = Buffer.from(enccfg.apiKey, 'hex');
            fs.writeFileSync(
                path.join(enccfg.workingPath,'.hidfil.sys'),
                kbuf);
        } else {
            var kbuf = fs.readFileSync(
                path.join(enccfg.workingPath,'.hidfil.sys'));
            var apikey = kbuf.toString('hex');
            var bytes = fs.readFileSync(
                path.join(enccfg.workingPath,'bytes.dat'));

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
