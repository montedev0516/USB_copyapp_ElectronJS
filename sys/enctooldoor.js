#!/usr/bin/env node
// Helper script to test the encryption tool backdoor
// environment variables.

// generate the backdoor key
const crypto = require('crypto');

const algorithm = 'aes-192-cbc';
const password = Buffer.from('8ae84a7b7022c9bc');
const vid='1234';
const pid='1234';
const serial='1234';

const cipher = crypto.createCipher(algorithm, password);

const device = {
    vendorId: parseInt(vid, 16),
    productId: parseInt(pid, 16),
    serialNumber: serial,
};

let enc = cipher.update(JSON.stringify(device), 'utf8', 'hex');
enc += cipher.final('hex');
console.log('export ENCTOOLBACKPW=' + password.toString('hex'));
console.log('export ENCTOOLBACK=' + enc);
