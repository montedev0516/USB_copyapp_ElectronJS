//
// server
//
var cfg = require('./config.json');

const express = require('express');
const fs = require('fs');
const pwsys = require('./src/password');
const crypto = require('crypto');

var app = express();

app.get('/status', function(req, res) {
    res.json({
        "running": true,
        "status": "running"
    });
});

// Get the random bytes buffer used for encryption.  This /could/
// also be encrypted, but it would be trivially easy to get the secret
// to decrypt it, so why?
var bytes = fs.readFileSync('bytes.dat');

app.get('/x', function(req, res) {
    var fname = './content/' + req.query.f; // TODO now: sanitize this filename
    var type = req.query.t;
    console.log('decrypt: ' + fname);
    fs.readFile(fname, (err, data) => {
        if (err) {
            console.log('READ ERROR: ' + err);
            res.sendStatus(404);
        } else {
            var cipher = crypto.createDecipher(
                'aes-256-cbc',
                pwsys.makePassword('123','1.2','whatever','whatwhat', bytes)
            );

            var decrypted = Buffer.concat(
                [cipher.update(data), cipher.final()]
            );
            console.log('data size: ' + data.length);
            console.log('decrypt size: ' + decrypted.length);

            res.set('Content-Type', type);
            res.send(decrypted);
        }
    });

});

app.listen(cfg.SERVER_PORT, () => {
    console.log('Listening on ' + cfg.SERVER_PORT);
});

