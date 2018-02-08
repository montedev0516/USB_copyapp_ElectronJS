//
// server
//
var cfg = require('./config.json');

const express = require('express');
const fs = require('fs');
const pwsys = require('./src/password');
const crypto = require('crypto');

var _uuid = 'c02bb8c7-8cca-4805-9711-0545a471103f'; //null;
var _agent = null;

var app = express();

// Get the random bytes buffer used for encryption.  This /could/
// also be encrypted, but it would be trivially easy to get the secret
// to decrypt it, so why?
var bytes = fs.readFileSync('bytes.dat');

function isValid(av) {
    [req, res] = av;
    if (_uuid == null || _agent == null) {
        // disallow connection if server not set up
        res.sendStatus(500);
        return false;
    }

    if (!(req.get('user-agent') === _agent &&
          req.get('session-id') === _uuid)) {
        // disallow connection from external browser
        res.sendStatus(401);
        return false;
    }

    return true;
}

app.get('/status', function(req, res) {
    if (!isValid([req, res])) { return; }

    res.json({
        "running": true,
        "status": "running"
    });
});

app.get('/x', function(req, res) {
    if (!isValid([req, res])) { return; }

    let fname = './content/' + req.query.f; // TODO now: sanitize this filename
    let type = req.query.t;
    let key = req.get('x-api-key');
    console.log('decrypt: ' + fname);
    fs.readFile(fname, (err, data) => {
        if (err) {
            console.log('READ ERROR: ' + err);
            res.sendStatus(404);
        } else {
            let decipher = crypto.createDecipher(
                'aes-256-cbc',
                pwsys.makePassword('123','1.2','whatever', key, bytes)
            );

            try {
                let decrypted = Buffer.concat(
                    [decipher.update(data), decipher.final()]
                );

                res.set('Content-Type', type);
                res.send(decrypted);
            } catch (err) {
                console.log('DECRYPT ERROR: ' + err);
                res.sendStatus(404);
            }
        }
    });

});

app.listen(cfg.SERVER_PORT, () => {
    console.log('Listening on ' + cfg.SERVER_PORT);
});

exports.lockSession = (uuid, agent) => {
    _uuid = uuid;
    _agent = agent;
};
