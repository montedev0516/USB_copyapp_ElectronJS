#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const pwsys = require('../src/password');

const enccfg = require('./encrypt-config.json');
const srvcfg = require('../config.json');

var doEncrypt = true;
var files = [];

for (var i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '-d') {
        doEncrypt = false;
        continue;
    }

    var fn = process.argv[i];
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
    var input = fs.createReadStream(file);
    var output = fs.createWriteStream(fnout);

    input.pipe(cipher).pipe(output);
    input.on('end', () => {
        console.log(fnout);
        // process next file
        go(idx + 1, serial, vers, secret, bytes);
    });
}

if (files.length > 0) {
    console.log('encrypting ' + files.length + ' files');

    let serial = pwsys.getSerial(enccfg);
    let vers = pwsys.getVersion(enccfg);
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
