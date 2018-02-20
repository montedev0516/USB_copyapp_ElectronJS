const electron = require('electron');
const app = electron.app;

const path = require('path');
const url = require('url');
const uuidv4 = require('uuid/v4');
const fs = require('fs');

console.log('EveryUSB Constent System starting');

// start the server
const server = require('./server.js');

let mainWindow;
let sessionId = uuidv4();

function createWindow() {
    mainWindow = new electron.BrowserWindow();

    mainWindow
        .webContents.session.webRequest
        .onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['x-api-key'] =
            fs.readFileSync(path.join(__dirname, '../.hidfil.sys')).toString('hex');
        details.requestHeaders['session-id'] = sessionId;
        callback({cancel:false, requestHeaders: details.requestHeaders});
    });
    server.lockSession(sessionId,
                       mainWindow.webContents.session.getUserAgent());

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, '/evusb.html'),
        protocol: 'file:',
        slashes: true
    }));

    //mainWindow.webContents.openDevTools()

    mainWindow.on('closed', function() {
        mainWindow = null;
        process.exit(0);
    });
}

app.on('ready', createWindow);

