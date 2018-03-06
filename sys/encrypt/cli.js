#!/usr/bin/env node

const encrypt = require('./encrypt');

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
