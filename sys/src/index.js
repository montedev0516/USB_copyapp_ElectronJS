
const path = require('path');
const url = require('url');
const uuidv4 = require('uuid/v4');
const fs = require('fs');
const opn = require('opn');
const Worker = require('tiny-worker');
const log4js = require('log4js');

const electron = require('electron');

const { app } = electron;
app.commandLine.appendSwitch('ignore-certificate-errors');

let logger;
let mainWindow;
let workerThread;
const sessionId = uuidv4();

/* eslint-disable no-restricted-globals */

function createServerWorker() {
    const worker = new Worker(() => {
        let server;

        /* global self */
        self.onmessage = (e) => {
            // terminate message
            if (server && e.data.terminate) {
                server.terminate();
                logger.info('Server terminated');
                worker.terminate();
            }

            try {
                // eslint-disable-next-line global-require, import/no-dynamic-require
                server = require(e.data.serverjs);
                logger.info('calling server.go()');
                server.go(e.data);
            } catch (e) {
                logger.error('server exception ' + e);
                self.postMessage('EXCEPTION: ' + e);
            }
        };

        self.onerror = (e) => {
            logger.error('event exception ' + e);
            self.postMessage('EXCEPTION: ' + e);
        };

    }, [], {
        detach: true,
        stdio: 'ignore',
    });
    worker.onmessage = (event) => {
        if (event.data.length > 0) {
            throw new Error(event.data);
        }
    };

    return worker;
}

function workerThreadRestart(code, pserverjs, plocator,
                             psessionId, puserAgent)
{
    // exit if main process is gone
    if (!mainWindow) return;

    // The worker process does NOT PLAY WELL at all with
    // electron.  We need to keep restarting it.
    logger.info('Starting worker server thread, session ' + psessionId);
    workerThread = createServerWorker();

    workerThread.child.once('exit', (ecode, sig) => {
        logger.error('Server died with code: ' + ecode + ', signal: ' + sig);
        workerThreadRestart(ecode, pserverjs, plocator, psessionId, puserAgent);
    });

    // send message to start things...
    workerThread.postMessage({
        serverjs: pserverjs,
        locator: plocator,
        sessionId: psessionId,
        userAgent: puserAgent,
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

    if (typeof(locator.logging) != 'undefined') {
        log4js.configure({
            appenders: {
                logs: {
                    type: 'file',
                    filename: path.join(locator.logging,'ucp-index.log'),
                },
            },
            categories: {
                app: { appenders: ['logs'], level: 'debug' },
                default: { appenders: ['logs'], level: 'debug' },
            }
        });
        logger = log4js.getLogger('app');
    } else {
        log4js.configure({
            appenders: { log: { type: 'stderr' } },
            categories: { default: { appenders: ['log'], level: 'error' } },
        });
        logger = log4js.getLogger();
    }
    logger.info('shared: ' + locator.shared);
    logger.info('app: ' + locator.app);
    logger.info('drive: ' + locator.drive);

    return locator;
}

// When in file browser mode, we want the title of the
// window to reflect the decrypted document, not the URL.
function setTitle(win, nurl) {
    if (!nurl) {
        return '';
    }

    const fbmatch = nurl.match(/b?.*f=(.*)$/);
    let title = '';
    if (fbmatch && fbmatch[1]) {
        title = decodeURIComponent(fbmatch[1]).replace('.lock', '');
        win.setTitle(title);
    }

    return title;
}

function onDomReady(win, nurl) {
    // Helper function to set the title when using the file browser.
    const title = setTitle(win, nurl);

    // Prevent a "save file" dialog on files that cannot be viewed in
    // the browser - we want to prevent downloading files
    // See:
    // https://github.com/electron/electron/blob/master/docs/api/
    //                                   session.md#event-will-download
    // and
    // https://github.com/electron/electron/issues/5024#issuecomment-206050802

    win.webContents.session.on('will-download', (event, item, webContents) => {
        // Cancel the download
        event.preventDefault();

        // Load the "unsupported content" page into the window
        // https://electronjs.org/docs/api/
        //                web-contents#contentsloadurlurl-options
        webContents.loadFile('src/unsupported-content.html');
    });

    // Standard JS injection.
    // * remove the PDF toolbar to put roadblock against download
    // * provide callback for opening external URLs in
    //   the electron browser (insecure), if we have node integration.
    // * add retry loop for the video, if any
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
            const nt = '${title}';
            if (nt) {
                window.addEventListener('pdf-loaded', () => {
                    document.title = nt;
                });
            }
        }

        vtb = document.querySelector('video');
        let sources = [];
        if (vtb) {
            vtb.setAttribute('controlsList', 'nodownload');
            sources = vtb.querySelectorAll('source');
        }

        if (sources.length !== 0) {
            let lastSource = sources[sources.length - 1];
            let retries = 20;
            lastSource.addEventListener('error', function() {
                setTimeout( function() {
                    retries--;
                    if (retries > 0) {
                        vtb.appendChild(lastSource);
                        vtb.load();
                        vtb.play();
                    } else {
                        alert('video cannot be played');
                    }
                }, 2000);
            });
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
        logger.warn('Warning: Opening external URL in browser ' + url);
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

        win.webContents.on('dom-ready', () => onDomReady(win, nurl));
        win.webContents.on('will-navigate', onOpenUrl);

        mainWindow.newGuest = win;
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        workerThread.postMessage({ terminate: true });
        process.nextTick(() => {
            workerThread.terminate();
            app.exit(0);
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
