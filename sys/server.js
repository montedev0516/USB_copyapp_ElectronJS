//
// server
//
var cfg = require('./config.json');

const express = require('express');
var app = express();

app.get('/status', function(req, res) {
    res.json({
        "running": true,
        "status": "running"
    });
});

app.listen(cfg.SERVER_PORT, function() {
    console.log('Listening on ' + cfg.SERVER_PORT);
});

