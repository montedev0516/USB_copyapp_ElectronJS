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
    mainWindow = new electron.BrowserWindow({
	width: 800,
	height: 600,
	webPreferences: {
	    plugins: true
	}
    });

    mainWindow
        .webContents.session.webRequest
        .onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['x-api-key'] =
            fs.readFileSync('.hidfil.sys').toString('hex');
        details.requestHeaders['session-id'] = sessionId;
        callback({cancel:false, requestHeaders: details.requestHeaders});
    });
    server.lockSession(sessionId,
                       mainWindow.webContents.session.getUserAgent());

    mainWindow.maximize();

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'evusb.html'),
        protocol: 'file:',
        slashes: true
    }));

    mainWindow.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        var win = new electron.BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                plugins: true
            }
        });
        win.loadURL(url);

        win.webContents.on('dom-ready', () =>
            win.webContents.executeJavaScript(
                "tb = document.querySelector('viewer-pdf-toolbar'); " +
                "if (tb) { tb.style.display = \"none\" }")
        );

        mainWindow.newGuest = win;
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

