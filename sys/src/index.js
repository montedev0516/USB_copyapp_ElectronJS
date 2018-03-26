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
    const server = require('./server.js');

    mainWindow = new electron.BrowserWindow({
        width: 800,
        height: 600,
        backgroundColor: '#666666',
        icon: path.join(__dirname, 'img/appicon.png'),
        show: false,
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

    // ipc connector
    electron.ipcMain.on('openlocal-message', (ev, url) => {
        console.log('Warning: Opening external URL in browser ' + url);
        mainWindow.loadURL(url);
    });

    // load start page
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    mainWindow.webContents.on('dom-ready', () => onDomReady(mainWindow));
    mainWindow.webContents.on('will-navigate', onOpenUrl);

    mainWindow.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        var win = new electron.BrowserWindow({
            width: 800,
            height: 600,
            icon: path.join(__dirname, 'img/appicon.png'),
            webPreferences: {
                plugins: true
            }
        });
        win.loadURL(url);

        win.webContents.on('dom-ready', () => onDomReady(win));
        win.webContents.on('will-navigate', onOpenUrl);

        mainWindow.newGuest = win;
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        process.exit(0);
    });

    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.maximize();

        // Start the server.  This can be a long
        // call, since it also searches for USB drives.
        // Unfortunately, none of the events ensure that
        // the window is actually drawn, so a timeout is needed.
        setTimeout(() => {
            server.readUSBThenStart()
        }, 333);
    });
}

function systemOpenUrl(url) {
    opn(url);
}

function onDomReady(win) {
    // Standard JS injection.
    // * remove the PDF toolbar to put roadblock against download
    // * provide callback for opening external URLs in
    //   the electron browser (insecure)
    win.webContents.executeJavaScript(
`
        const {ipcRenderer} = require('electron');
        if (typeof(window.jQuery) === 'undefined') {
            window.$ = window.jQuery = require('jquery');
        }
        $("[data-openlocal='true']").click(function(ev) {
            ev.preventDefault();
            // this will prevent triggering the onOpenUrl()
            // call below.
            ipcRenderer.send('openlocal-message', ev.target.href);
        });

        tb = document.querySelector('viewer-pdf-toolbar');
        if (tb) { tb.style.display = 'none'; }
`
    );
}



function onOpenUrl(ev, url) {
    if (!url.match(/^https:\/\/localhost/)) {
        ev.preventDefault();
        console.log('Warning: Opening external URL using system ' + url);
        systemOpenUrl(url);
    }
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

