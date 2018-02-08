#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const pwsys = require('./src/password');

var files = [];
for (var i = 2; i < process.argv.length; i++) {
    var fn = process.argv[i];
    if (fs.existsSync(fn)) {
        files.push(fn);
    } else {
        console.error('File not found: ' + fn);
        process.exit(-1);
    }
}

var secret = pwsys.makepw('123','1.2','whatever','whatwhat');

if (files.length > 0) {
    console.log('encrypting ' + files.length + ' files');

    var cipher = crypto.createCipher('aes-256-cbc', secret);

    for (fn in files) {
        var fnout = files[fn] + '.evusb';
        var input = fs.createReadStream(files[fn]);
        var output = fs.createWriteStream(fnout);

        input.pipe(cipher).pipe(output);
        console.log(fnout);
    }
}
