#!/usr/bin/env node
// Helper script to test the encryption tool backdoor
// environment variables.
/*
    How to USE enctooldoor?

    This is script for test the app without USB.
    Change the vid, pid, serial number with the inputed values that you typed in encryption tool
    And the change the url to your out folder
    
    The important thing is you have to run this scrypt everytime when you encrypt the audio with encryption tool
*/

const os = require('node:os');
const crypto = require('crypto');
const fs = require('fs');

let username = 'davek';
if (os.version().startsWith('Windows')) {
  username = 'davidd';
}

// Generate the backdoor key
const srvcfg = JSON.parse(
    fs.readFileSync(
        `F:/electron/Troy/test/audio/shared/usbcopypro.json`
    )
);

const algorithm = 'aes-192-cbc';
const salt = srvcfg.salt;
const password = '1f5d34fa476946c0';
const encpass = Buffer.from(password + 'dd' + salt, 'hex');
const vid = '346D';
const pid = '5678';
const serial = '';

const cipher = crypto.createCipher(algorithm, encpass);

const device = {
    vendorId: parseInt(vid, 16),
    productId: parseInt(pid, 16),
    serialNumber: serial,
};

let enc = cipher.update(JSON.stringify(device), 'utf8', 'hex');
enc += cipher.final('hex');

// Prepare the environment variable content
const envContent = [
    `ENCTOOLBACKPW=${password}`,
    `ENCTOOLBACK=${enc}`,
    `ENCTOOLLOC=F:/electron/Troy/test/audio/shared/usbcopypro.json`
].join('\n');

// Write to .env file
fs.writeFileSync('.env', envContent, { encoding: 'utf8' });

console.log('Environment variables written to .env file.');
