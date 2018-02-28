#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const pwsys = require('../src/password');

const srvcfg = require('../src/config.json');

var files = [];

if (process.argv[2] === '-h' || process.argv[2] === '--help') {
    console.error('Usage: ' + process.argv[1] + '[--config file.json]');
    console.error('      file.json: default -> encrypt-config.json');
    process.exit(0);
}

var enccfg = require('./encrypt-config.json');
if (process.argv[2] === '--config') {
    enccfg = require(process.argv[3]);
} else {
    enccfg = require('./encrypt-config.json');
}

var doEncrypt = enccfg.encrypt;

// validate files
for (var i = 0; i < enccfg.files.length; i++) {
    var fn = enccfg.files[i];
    if (fs.existsSync(fn)) {
        files.push(fn);
    } else {
        console.error('File not found: ' + fn);
        process.exit(-1);
    }
}

function go(idx, serial, vers, secret) {
    if (idx >= files.length) {
        return;
    }

    file = files[idx];
    var cipher;
    if (doEncrypt) {
        cipher = crypto.createCipher('aes-256-cbc', secret);
    } else {
        cipher = crypto.createDecipher('aes-256-cbc', secret);
    }

    var fnout;
    if (doEncrypt) {
        fnout = file + '.lock';
    } else {
        fnout = file.replace('.lock','');
    }
    fnout = fnout.replace(enccfg.inputPathTrim, enccfg.outputPathPrefix);
    var input = fs.createReadStream(file);
    var output = fs.createWriteStream(fnout);

    input.pipe(cipher).pipe(output);
    input.on('end', () => {
        console.log('wrote ' + fnout);
        // process next file
        go(idx + 1, serial, vers, secret, bytes);
    });
}

if (files.length > 0) {
    console.log('encrypting ' + files.length + ' files');

    let serial = pwsys.getSerial(enccfg, srvcfg);
    let vers = pwsys.getVersion(enccfg, srvcfg);
    console.log('serial: ' + serial);
    console.log('vers  : ' + vers);
    console.log('apikey: ' + enccfg.apiKey);

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

        console.log('key   : ' + apikey);
        secret = pwsys.makePassword(serial,
                                    vers,
                                    srvcfg.salt,
                                    apikey,
                                    bytes);
    }

    go(0, serial, vers, secret);
}
