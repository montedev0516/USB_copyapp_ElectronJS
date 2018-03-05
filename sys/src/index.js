const electron = require('electron');
const app = electron.app;
app.commandLine.appendSwitch('ignore-certificate-errors');

const path = require('path');
const url = require('url');
const uuidv4 = require('uuid/v4');
const fs = require('fs');
const opn = require('opn');

console.log('System starting');

let mainWindow;
let sessionId = uuidv4();

function createWindow() {
    // start the server
    const server = require('./server.js');

    mainWindow = new electron.BrowserWindow({
        width: 800,
        height: 600,
        backgroundColor: '#666666',
        icon: path.join(__dirname, 'img/appicon.png'),
        webPreferences: {
            plugins: true
        }
    });

    mainWindow
        .webContents.session.webRequest
        .onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['x-api-key'] =
            fs.readFileSync(path.join(__dirname, '../.hidfil.sys'))
              .toString('hex');
        details.requestHeaders['session-id'] = sessionId;
        callback({cancel:false, requestHeaders: details.requestHeaders});
    });

    server.lockSession(sessionId,
                       mainWindow.webContents.session.getUserAgent());

    mainWindow.maximize();

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    mainWindow.webContents.on('dom-ready', () => onDomReady(mainWindow));

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

        win.webContents.on('dom-ready', () => onDomReady(win));

        mainWindow.newGuest = win;
    });

    mainWindow.webContents.on('will-navigate', (ev, url) => {
        if (!url.match(/^https:\/\/localhost/)) {
            ev.preventDefault();
            systemOpenUrl(url);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        process.exit(0);
    });
}

function systemOpenUrl(url) {
    opn(url);
}

function onDomReady(win) {
    win.webContents.executeJavaScript(
        "tb = document.querySelector('viewer-pdf-toolbar'); " +
        "if (tb) { tb.style.display = \"none\" }")
}

let notPrimary = app.makeSingleInstance((c,wd) => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.focus();
    }
});

if (notPrimary) {
    app.exit(0);
} else {
    app.on('ready', createWindow);
}

