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


if (files.length > 0) {
    console.log('encrypting ' + files.length + ' files');

    var cipher;

    let serial = pwsys.getSerial(enccfg);
    let vers = pwsys.getVersion(enccfg);
    console.log('serial: ' + serial);
    console.log('vers  : ' + vers);

    if (doEncrypt) {
        var [bytes, secret] = pwsys.makeNewPassword(serial,
                                                    vers,
                                                    srvcfg.salt,
                                                    enccfg.apiKey);
        cipher = crypto.createCipher('aes-256-cbc', secret);
        fs.writeFileSync('bytes.dat', bytes);

        console.log('apikey: ' + enccfg.apiKey);
        var kbuf = Buffer.from(enccfg.apiKey, 'hex');
        fs.writeFileSync('.hidfil.sys', kbuf);
    } else {
        var kbuf = fs.readFileSync('.hidfil.sys');
        var apikey = kbuf.toString('hex');
        var bytes = fs.readFileSync('bytes.dat');

        console.log('apikey: ' + apikey);
        var secret = pwsys.makePassword(serial,
                                        vers,
                                        srvcfg.salt,
                                        apikey,
                                        bytes);
        cipher = crypto.createDecipher('aes-256-cbc', secret);
    }

    for (fn in files) {
        var fnout;
        if (doEncrypt) {
            fnout = files[fn] + '.lock';
        } else {
            fnout = files[fn].replace('.lock','');
        }
        var input = fs.createReadStream(files[fn]);
        var output = fs.createWriteStream(fnout);

        input.pipe(cipher).pipe(output);
        console.log(fnout);
    }
}