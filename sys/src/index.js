
const path = require('path');
const url = require('url');
const uuidv4 = require('uuid/v4');
const fs = require('fs');
const opn = require('opn');
const Worker = require('tiny-worker');

const electron = require('electron');

const { app } = electron;
app.commandLine.appendSwitch('ignore-certificate-errors');

let mainWindow;
let workerThread;
const sessionId = uuidv4();

/* eslint-disable no-restricted-globals */

function createServerWorker(pserverjs, plocator, psessionId, puserAgent) {
    const worker = new Worker(() => {
        let server;

        /* global self */
        self.onmessage = (event) => {
            // terminate message
            if (server && event.data.terminate) {
                server.terminate();
                return;
            }

            try {
                // eslint-disable-next-line global-require, import/no-dynamic-require
                server = require(event.data.serverjs);
                server.go(event.data);
            } catch (e) {
               self.postMessage('EXCEPTION: ' + e);
            }
        };

        self.onerror = (event) => {
           self.postMessage('EXCEPTION: ' + event);
        };

        self.postMessage('');
    });
    worker.postMessage({
        serverjs: pserverjs,
        locator: plocator,
        sessionId: psessionId,
        userAgent: puserAgent,
    });
    worker.onmessage = (event) => {
        if (event.data.length > 0) {
            throw new Error(event.data);
        }
    };

    return worker;
}

function workerThreadRestart(code, serverjs, locator, newSessionId, ua) {
    // exit if main process is gone
    if (!mainWindow) return;

    // The worker process does NOT PLAY WELL at all with
    // electron.  We need to keep restarting it.
    // console.log('Server died with code: ' + code + ', restarting');
    workerThread = createServerWorker(serverjs, locator, newSessionId, ua);

    workerThread.child.on('exit', (ecode) => {
        workerThreadRestart(ecode, serverjs, locator, newSessionId, ua);
    });
}

function findLocator() {
    const locatorFile = 'locator.json';
    let found = false;
    let dir = __dirname;
    do {
        if (fs.existsSync(path.join(dir, locatorFile))) {
            found = true;
            break;
        }
        if (path.dirname(dir) === dir) break;
        dir = path.resolve(dir, '..');
    } while (!found);

    if (!found) {
        throw new Error("can't find locator file: " + locatorFile);
    }

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const locator = require(path.join(dir, locatorFile));
    locator.shared = path.resolve(dir, locator.shared);
    locator.app = path.resolve(dir, locator.app);
    locator.drive = path.resolve(dir, locator.drive);
    // console.log('shared: ' + locator.shared);
    // console.log('app: ' + locator.app);
    // console.log('drive: ' + locator.drive);

    return locator;
}

function onDomReady(win) {
    // Standard JS injection.
    // * remove the PDF toolbar to put roadblock against download
    // * provide callback for opening external URLs in
    //   the electron browser (insecure), if we have node integration.
    win.webContents.executeJavaScript(`
        if (typeof(require) === "function") {
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
        }

        tb = document.querySelector('viewer-pdf-toolbar');
        if (tb) {
            tb.style.display = 'none';
        }

        vtb = document.querySelector('video');
        if (vtb) {
            vtb.setAttribute('controlsList', 'nodownload');
        }
    `);
}

function systemOpenUrl(nurl) {
    opn(nurl);
}

function onOpenUrl(ev, nurl) {
    if (!nurl.match(/^https:\/\/localhost/)) {
        ev.preventDefault();
        systemOpenUrl(nurl);
    }
}

function createWindow() {
    const locator = findLocator();

    mainWindow = new electron.BrowserWindow({
        width: 800,
        height: 600,
        backgroundColor: '#666666',
        icon: path.join(__dirname, 'img/appicon.png'),
        show: false,
        devTools: false,
        webPreferences: {
            plugins: true,
        },
    });

    // Start the server in a separate thread.
    workerThreadRestart(
        0,
        path.join(__dirname, '..', 'es6-shim-server.js'),
        locator,
        sessionId,
        mainWindow.webContents.session.getUserAgent(),
    );

    // mainWindow.webContents.openDevTools();

    mainWindow
        .webContents.session.webRequest
        .onBeforeSendHeaders((details, callback) => {
            const rh = details.requestHeaders;
            rh['x-api-key'] =
                fs.readFileSync(path.join(locator.shared, '.hidfil.sys'))
                  .toString('hex');
            rh['session-id'] = sessionId;
            callback({ cancel: false, requestHeaders: rh });
        });

    // ipc connectors
    electron.ipcMain.on('openlocal-message', (ev, nurl) => {
        // console.log('Warning: Opening external URL in browser ' + url);
        mainWindow.loadURL(nurl);
    });
    electron.ipcMain.on('getlocator-message', (ev) => {
        // eslint-disable-next-line no-param-reassign
        ev.returnValue = locator;
    });

    // load start page
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true,
    }));

    mainWindow.webContents.on('dom-ready', () => onDomReady(mainWindow));
    mainWindow.webContents.on('will-navigate', onOpenUrl);

    mainWindow.webContents.on('new-window', (event, nurl) => {
        event.preventDefault();
        const win = new electron.BrowserWindow({
            width: 800,
            height: 600,
            icon: path.join(__dirname, 'img/appicon.png'),
            webPreferences: {
                plugins: true,
            },
        });
        win.loadURL(nurl);

        win.webContents.on('dom-ready', () => onDomReady(win));
        win.webContents.on('will-navigate', onOpenUrl);

        mainWindow.newGuest = win;
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        workerThread.postMessage({ terminate: true });
        process.nextTick(() => {
            workerThread.terminate();
            process.exit(0);
        });
    });

    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.maximize();
        mainWindow.show();
    });
}

const notPrimary = app.makeSingleInstance(() => {
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

