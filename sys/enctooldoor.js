#!/usr/bin/env node
// Helper script to test the encryption tool backdoor
// environment variables.

// generate the backdoor key
const crypto = require('crypto');
const fs = require('fs');

const srvcfg = JSON.parse(
    fs.readFileSync('/home/davidd/work/t/encrypt/out/shared/usbcopypro.json'));

const algorithm = 'aes-192-cbc';
const salt = srvcfg.salt;
const password = '1f5d34fa476946c0';
const encpass = Buffer.from(password + 'dd' + salt, 'hex');
const vid='FFFF';
const pid='5678';
const serial='';

const cipher = crypto.createCipher(algorithm, encpass);

const device = {
    vendorId: parseInt(vid, 16),
    productId: parseInt(pid, 16),
    serialNumber: serial,
};

let enc = cipher.update(JSON.stringify(device), 'utf8', 'hex');
enc += cipher.final('hex');
console.log('export ENCTOOLBACKPW=' + password);
console.log('export ENCTOOLBACK=' + enc);
console.log(
    'export ENCTOOLLOC=' +
    '/home/davidd/work/usb/secure-usb-content/sys/locator.json'
);
/*
unset ENCTOOLLOC ENCTOOLBACKPW ENCTOOLBACK
 */
