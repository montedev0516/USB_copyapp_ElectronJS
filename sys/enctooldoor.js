#!/usr/bin/env node
// Helper script to test the encryption tool backdoor
// environment variables.

// generate the backdoor key
const crypto = require('crypto');

const algorithm = 'aes-192-cbc';
const salt = '1bbb51d536f620ba6384d62edea2affd0585d6dfca452fa0f54a123b6a364f9c'; // from usbcopypro.json
const password = '1f5d34fa476946c0';
const encpass = Buffer.from(password + 'dd' + salt, 'hex');
const vid='1234';
const pid='1234';
const serial='1234';

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
    '/home/davek/work/usb/secure-usb-content/sys/locator.json'
);
