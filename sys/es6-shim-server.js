
const path = require('path');
const electronCompile = require('electron-compile');

function go(data) {
    const initScript = path.resolve(__dirname, 'src', 'server.js');
    let inDev = false;
    let server;

    electronCompile.init(__dirname, initScript);

    server = require.main.server;

    server.configure(data.locator);
    server.lockSession(data.sessionId,
                       data.userAgent);
    server.readUSBThenStart()
}

module.exports.go = go;
