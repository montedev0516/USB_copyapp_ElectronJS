
const path = require('path');

let server;
function go(data) {
    const initScript = path.resolve(__dirname, 'src', 'server.js');
    let inDev = false;

    server = require(initScript);

    server.keepAlive = true;

    server.configure(data.locator);
    server.lockSession(data.sessionId,
                       data.userAgent);
    return server.readUSBThenStart()
}

function terminate() {
    if (server) {
        server.keepAlive = false;
    }
}

function sendMessage(msg) {
    if (server) {
        return server.sendMessage(msg);
    }
}

module.exports.go = go;
module.exports.terminate = terminate;
module.exports.sendMessage = sendMessage;
