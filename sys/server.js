//
// server
//
var cfg = require('./config.json');

const express = require('express');
const fs = require('fs');
var app = express();

app.get('/status', function(req, res) {
    res.json({
        "running": true,
        "status": "running"
    });
});

app.get('/x', function(req, res) {
    var fname = './content/' + req.query.f; // TODO now: sanitize this filename
    console.log('decrypt: ' + fname);
    fs.readFile(fname, (err, data) => {
        if (err) {
            console.log('READ ERROR: ' + err);
            res.sendStatus(404);
        } else {
            res.set('Content-Type', 'video/mp4');
            res.send(data);
        }
    });

});

app.listen(cfg.SERVER_PORT, () => {
    console.log('Listening on ' + cfg.SERVER_PORT);
});

