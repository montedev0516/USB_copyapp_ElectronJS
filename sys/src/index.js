
const path = require('path');
const url = require('url');
const uuidv4 = require('uuid/v4');
const fs = require('fs');
const opn = require('opn');
const Worker = require('tiny-worker');
const log4js = require('log4js');
const electron = require('electron');
const constants = require('./constants.js');

const { app } = electron;
app.commandLine.appendSwitch('ignore-certificate-errors');

let logger;
let mainWindow;
let workerThread;
let startCastCommandListResolve;
const {
    SHOWDEVTOOLSMAGIC,
    startCastCommandList,
} = constants;
const sessionId = uuidv4();

function showDevtoolsWin() {
    if (process.env.ENCTOOLLOC === undefined) {
        return;
    }

    if (!mainWindow) {
        setTimeout(showDevtoolsWin, 1000);
        return;
    }

    mainWindow.webContents.openDevTools();
}

/* eslint-disable no-restricted-globals */
/* eslint-disable global-require */

function createServerWorker() {
    // This should be in its own file, but that is very impractical
    // because of the js compilation and other electrion quirks.
    const worker = new Worker(() => {
        const ppath = require('path');
        const log4jsw = require('log4js');
        // eslint-disable-next-line no-shadow
        const constants = require('../../../src/constants.js');
        const {
            SHOWDEVTOOLSMAGIC,
            startCastCommandList,
        } = constants;
        let server;
        let wlogger;

        function loggingSetup(plogging) {
            const vlogging = plogging;
            if (typeof vlogging !== 'undefined') {
                const fname = ppath.join(vlogging, 'ucp-worker.log');
                log4jsw.configure({
                    appenders: {
                        logs: {
                            type: 'file',
                            filename: fname,
                        },
                    },
                    categories: {
                        worker: { appenders: ['logs'], level: 'debug' },
                        default: { appenders: ['logs'], level: 'debug' },
                    },
                });
                wlogger = log4jsw.getLogger('worker');
            } else {
                log4jsw.configure({
                    appenders: { logs: { type: 'stderr' } },
                    categories: {
                        default: {
                            appenders: ['logs'], level: 'error',
                        },
                    },
                });
                wlogger = log4jsw.getLogger();
            }
        }

        // eslint-disable-next-line no-undef
        onmessage = (e) => {
            // startCast message
            if (e.data.startCast) {
                wlogger.info('Got startCast signal');
                server.sendMessage({
                    startCast: {
                        targetPath: e.data.startCast.targetPath,
                        castUUID: e.data.startCast.castUUID,
                        castIP: e.data.startCast.castIP,
                    },
                }).then((result) => {
                    wlogger.info(`Got startCast result: ${result}`);
                    let devices = [];
                    if (result) {
                        try {
                            devices = JSON.parse(result);
                        } catch (jsone) {
                            wlogger.error(
                                `startCast JSON parse: ${jsone.message}`
                            );
                            devices = [];
                        }
                    }
                    if (devices instanceof Array && devices.length > 0) {
                        wlogger.info(
                            'Got startCast list ' +
                            `result, ${devices.length} devices`
                        );
                        // command was to list devices
                        const str = JSON.stringify({ devices });
                        // eslint-disable-next-line no-undef
                        postMessage(`${startCastCommandList}${str}`);
                    }
                });
                return;
            }

            // terminate message
            if (server && e.data.terminate) {
                if (wlogger) {
                    wlogger.info('Server terminating');
                }
                server.terminate();
                return;
            }

            if (!wlogger && e.data.locator) {
                loggingSetup(e.data.locator.logging);
                wlogger.info('worker logger started');
            }

            if (typeof e.data.serverjs === 'undefined') {
                if (wlogger) {
                    wlogger.warn('unknown message data: ' +
                                 JSON.stringify(e.data));
                }
                return;
            }

            // start message
            try {
                // eslint-disable-next-line global-require, import/no-dynamic-require
                server = require(e.data.serverjs);
                wlogger.info('calling server.go()');
                const showDevtools = server.go(e.data);
                if (showDevtools) {
                    wlogger.warn('enctool DETECTED, showing dev tools');
                    // eslint-disable-next-line no-undef
                    postMessage(SHOWDEVTOOLSMAGIC);
                }
            } catch (er) {
                if (wlogger) {
                    wlogger.error('server exception ' + er);
                    wlogger.error(er.stack);
                }
                // eslint-disable-next-line no-undef
                postMessage('EXCEPTION: ' + er);
            }
        };

        // eslint-disable-next-line no-undef
        onerror = (e) => {
            if (wlogger) {
                wlogger.error('event exception ' + e);
            }
            // eslint-disable-next-line no-undef
            postMessage('EXCEPTION: ' + e);
        };
    },
    // comment out this detach section for debugging
    [], {
        detach: true,
        stdio: 'ignore',
        esm: true,
    });
    worker.onmessage = (ev) => {
        if (ev.data.length > 0) {
            if (logger) {
                logger.error('WORKER: ' + ev.data);
            }

            // Message from worker thread that we're in
            // the dev state, and we should show the dev tools window.
            if (ev.data === SHOWDEVTOOLSMAGIC) {
                logger.warn('Got SHOWDEVTOOLSMAGIC!');
                showDevtoolsWin();
                return;
            }

            if (ev.data.startsWith(startCastCommandList)) {
                logger.warn('Got startCastCommandList result');
                const resultJSON = ev.data.replace(startCastCommandList, '');
                logger.warn(resultJSON);
                startCastCommandListResolve(JSON.parse(resultJSON));
                return;
            }

            throw new Error(ev.data);
        }
    };
    worker.onerror = (err) => {
        if (logger) {
            logger.error(err);
        }
    };

    return worker;
}

function workerThreadRestart(code, pserverjs, plocator,
                             psessionId, puserAgent) {
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
    let locatorPath;

    // If there is ENCTOOLLOC env defined, use it as the path
    // to the locator.  This is used by the "launch" feature
    // in the encryption tool.
    let pathDefined = false;
    if (process.env.ENCTOOLLOC !== undefined) {
        pathDefined = true;
        locatorPath = process.env.ENCTOOLLOC;
        dir = path.dirname(locatorPath);
    } else {
        locatorPath = path.join(dir, locatorFile);
    }

    do {
        if (fs.existsSync(locatorPath)) {
            found = true;
            break;
        }
        if (pathDefined || (path.dirname(dir) === dir)) break;
        dir = path.resolve(dir, '..');
        locatorPath = path.join(dir, locatorFile);
    } while (!found);

    if (!found) {
        let errstr = "can't find locator file: " + locatorFile;
        if (pathDefined) {
            errstr += '\npath: ' + locatorPath;
        }
        throw new Error(errstr);
    }


    const locator = JSON.parse(fs.readFileSync(locatorPath, 'utf8'));
    locator.shared = path.resolve(dir, locator.shared);
    locator.app = path.resolve(dir, locator.app);
    locator.drive = path.resolve(dir, locator.drive);

    if (typeof locator.logging !== 'undefined') {
        log4js.configure({
            appenders: {
                logs: {
                    type: 'file',
                    filename: path.join(locator.logging, 'ucp-index.log'),
                },
            },
            categories: {
                index: { appenders: ['logs'], level: 'debug' },
                default: { appenders: ['logs'], level: 'debug' },
            },
        });
        logger = log4js.getLogger('index');
    } else {
        log4js.configure({
            appenders: { logs: { type: 'stderr' } },
            categories: { default: { appenders: ['logs'], level: 'error' } },
        });
        logger = log4js.getLogger();
    }
    logger.info('locator: ' + locatorPath);
    logger.info('dir: ' + dir);
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

    win.webContents.session.removeAllListeners('will-download');
    win.webContents.session.on('will-download', (event, item, webContents) => {
        // Insert the PDF viewer.  This should not be required
        // after Electron 9.
        if (item.getMimeType() === 'application/pdf' &&
            item.getURL().indexOf('blob:file:') !== 0)
        {
            event.preventDefault();

            const winid = webContents.id;

            webContents.loadURL('file://' +
                path.resolve(
                    __dirname,
                    `pdfjs/web/viewer.html?file=${item.getURL()}`,
                ));

            mainWindow.webContents.executeJavaScript(`
                global['_dlenabled'] = global['dlenabled']||false;
                global['dlenabled'] = false;
                global['_dlenabled'];
            `).then((dlenabled) => {
                // For new windows opened by window.open js, the global
                // is used.  For <a> links that use data-dlenabled=true,
                // the IPC command "dlenabled-message" is used.
                const ldl = mainWindow.dlenabled || dlenabled;
                mainWindow.dlenabled = false;
                logger.info('win ' + winid +
                            ' DL enabled: ' + ldl);
                const wc = electron.webContents.fromId(winid);
                wc.dlenabled = ldl;
            });

            return;
        }

        if (webContents.dlenabled) {
            // allow it
            return;
        }

        // Cancel the download
        event.preventDefault();

        logger.info('Preventing download and displaying "unsupported content"');
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
    // TODO: can this be (mostly) moved to preload.js?
    win.webContents.executeJavaScript(`
        var logger;
        if (typeof(require) === "function") {
            if (typeof(window.jQuery) === 'undefined') {
                window.$ = window.jQuery = require('jquery');
            }
            window.api.addLogger();
            logger = window.logger;

            window.api.addDataHooks(window.jQuery);
            window.api.addChromecastHooks(window.jQuery);
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
        var sources = [];
        if (vtb) {
            vtb.setAttribute('controlsList', 'nodownload');
            sources = vtb.querySelectorAll('source');
        }

        if (sources.length !== 0) {
            let lastSource = sources[sources.length - 1];
            let retries = 20;
            let inhandler = 0;
            lastSource.addEventListener('error', function(e) {
                if (logger) {
                    logger.error('video playback error (VTB): ' + vtb.error);
                    if (e) {
                        logger.error('video playback error (E): ' + e);
                        logger.error('video playback error (MSG): ' +
                                     e.message);
                    }
                }
                setTimeout( function() {
                    retries--;
                    if (retries > 0) {
                        if (logger) {
                            logger.warn('video error, retries: ' + retries);
                        }
                        vtb.appendChild(lastSource);
                        vtb.load();
                    } else {
                        if (logger) {
                            logger.error('failed to play video');
                        }
                        alert('video cannot be played');
                    }
                }, 1000);
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

function enableCast(targetUrl, usbCastUUID, usbCastIP) {
    workerThread.postMessage({
        startCast: {
            targetPath: targetUrl,
            castUUID: usbCastUUID,
            castIP: usbCastIP,
        }
    });
}

async function listCast() {

    let prom = new Promise((resolve, reject) => {
        startCastCommandListResolve = (s) => {
            resolve(s);
        };
    });
    workerThread.postMessage({
        startCast: {}
    });

    let listResult = await prom;
    logger.info('Received result from cast list:');
    logger.info(listResult);

    return listResult.devices;
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
            preload: path.join(app.getAppPath(), 'src', 'preload.js'),
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

    const apikey =
        fs.readFileSync(path.join(locator.shared, '.hidfil.sys'))
          .toString('hex');
    mainWindow
        .webContents.session.webRequest
        .onBeforeSendHeaders((details, callback) => {
            const rh = details.requestHeaders;
            rh['x-api-key'] = apikey;
            rh['session-id'] = sessionId;
            callback({ cancel: false, requestHeaders: rh });
        });

    // ipc connectors
    electron.ipcMain.on('openlocal-message', (ev, nurl) => {
        logger.warn('Warning: Opening external URL in browser ' + url);
        mainWindow.loadURL(nurl);
    });
    electron.ipcMain.on('dlenabled-message', (ev, nurl) => {
        logger.warn('Warning: Download enabled for URL ' + url);
        mainWindow.dlenabled = true;
    });
    electron.ipcMain.on('getlocator-message', (ev) => {
        // eslint-disable-next-line no-param-reassign
        ev.returnValue = locator;
    });
    electron.ipcMain.on('usbcast-message', (ev, target) => {
        const { targetUrl, usbCastUUID, usbCastIP } = target;
        logger.info(
            'received usbcast-message:' +
            `${targetUrl} ${usbCastUUID} ${usbCastIP}`
        );
        enableCast(targetUrl, usbCastUUID, usbCastIP);
    });
    electron.ipcMain.on('usbcastlist-message', async (ev) => {
        logger.info('received usbcastlist-message');
        ev.returnValue = await listCast();
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

app.allowRendererProcessReuse = false;

if (app.requestSingleInstanceLock()) {
    app.on('ready', createWindow);
} else {
    app.exit(0);
}

app.on('second-instance', (event, argv, cwd) => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.focus();
    }
});

