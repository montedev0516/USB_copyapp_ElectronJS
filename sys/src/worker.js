const path = require('path');
const log4jsw = require('log4js');
let server;
let wlogger;

function loggingSetup(logging) {
    if (typeof(logging) != 'undefined') {
        log4jsw.configure({
            appenders: {
                logs: {
                    type: 'file',
                    filename: path.join(logging, 'ucp-worker.log'),
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
            categories: { default: { appenders: ['logs'], level: 'error' } },
        });
        wlogger = log4jsw.getLogger();
    }
}

onmessage = (e) => {
    if (!wlogger) {
        loggingSetup(e.data.locator.logging);
        wlogger.info('worker logger started');
    }

    // terminate message
    if (server && e.data.terminate) {
        if (wlogger) {
            wlogger.info('Server terminating');
        }
        server.terminate();
        return;
    }

    if (typeof(e.data.serverjs) === 'undefined') {
        wlogger.warn('unknown message data: ' + JSON.stringify(e.data));
        return;
    }

    // start message
    try {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        server = require(e.data.serverjs);
        wlogger.info('calling server.go()');
        server.go(e.data);
    } catch (e) {
        if (wlogger) {
            wlogger.error('server exception ' + e);
            wlogger.error(e.stack);
        }
        postMessage('EXCEPTION: ' + e);
    }
};

onerror = (e) => {
    if (wlogger) {
        wlogger.error('event exception ' + e);
    }
    postMessage('EXCEPTION: ' + e);
};
