
const path = require('path');
const electronCompile = require('electron-compile');

let server;
function go(data) {
    const initScript = path.resolve(__dirname, 'src', 'server.js');
    let inDev = false;

    electronCompile.init(__dirname, initScript);

    server = require.main.server;

    server.configure(data.locator);
    server.lockSession(data.sessionId,
                       data.userAgent);
    server.readUSBThenStart()
}

function terminate() {
    if (server) {
        server.keepAlive = false;
    }
}

module.exports.go = go;
module.exports.terminate = terminate;
