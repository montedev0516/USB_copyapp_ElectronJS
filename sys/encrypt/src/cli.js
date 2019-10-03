#!/usr/bin/env node

/* eslint-disable no-console, global-require, import/no-dynamic-require */

const encrypt = require('./encrypt');

let enccfg;

if (process.argv[2] === '-h' || process.argv[2] === '--help') {
    console.error('Usage: ' + process.argv[1] + '[--config file.json]');
    console.error('      file.json: default -> encrypt-config.json');
    process.exit(0);
}

if (process.argv[2] === '--config') {
    enccfg = require(process.argv[3]);
} else {
    enccfg = require('./encrypt-config.json');
}

function messageCallback(s, isError) {
    if (isError) {
        console.error('ERROR: ' + s);
    } else {
        console.log(s);
    }
}

function encCallback(idx, total, isDone) {
    if (isDone) {
        console.log('\nencrypted ' + idx + ' files');
    } else {
        process.stdout.write('\r' + idx + ' / ' + total + '    ');
    }
}

function unencCallback(idx, total, isDone) {
    if (isDone) {
        console.log('\ncopied ' + idx + ' files');
    } else {
        process.stdout.write('\r' + idx + ' / ' + total + '    ');
    }
}

encrypt(enccfg, messageCallback, encCallback, unencCallback);
