//
// preloaded by render process
//

const {
    ipcRenderer
} = require('electron');

console.log('loading preload.js');

var usbCastUUID;
var usbCastIP;

if (typeof window.api === 'undefined') {
    window.api = {};
}

function logmsg(s) {
    if (window.logger) {
        window.logger.info(s);
    }
    console.log(s);
}

window.api.addLogger = () => {
    const path = require('path');
    const log4js = require('log4js');
    const locator = ipcRenderer.sendSync('getlocator-message');

    if (typeof(locator.logging) !== 'undefined') {
        log4js.configure({
            appenders: {
                logs: {
                    type: 'file',
                    filename: path.join(locator.logging,
                                        'ucp-browser.log'),
                },
            },
            categories: {
                browser: { appenders: ['logs'], level: 'debug' },
                default: { appenders: ['logs'], level: 'debug' },
            }
        });
        window.logger = log4js.getLogger('browser');
    } else {
        log4js.configure({
            appenders: { logs: { type: 'stderr' } },
            categories: { default: {
                appenders: ['logs'],
                level: 'error'
            }},
        });
        window.logger = log4js.getLogger();
    }
    logmsg('log4js started on page');
};

window.api.addDataHooks = (jQuery) => {
    jQuery("[data-openlocal='true']").click(function(ev) {
        ev.preventDefault();
        // this will prevent triggering the onOpenUrl()
        // call below.
        ipcRenderer.send('openlocal-message', ev.target.href);
    });

    jQuery("[data-dlenabled='true']").click(function(ev) {
        ipcRenderer.send('dlenabled-message', ev.target.href);
    });
    logmsg('addDataHooks: added hooks');
};

window.api.addChromecastHooks = (jQuery) => {
    jQuery("[data-usbcast='true']").click(function(ev) {
        const targetUrl = ev.currentTarget.dataset['usbcastSource'];
        logmsg(`usbcast: target ${targetUrl}`);
        if (targetUrl && usbCastUUID && usbCastIP) {
            ipcRenderer.send('usbcast-message', targetUrl);
        } else {
            castInfo = ipcRenderer.sendSync('usbcastlist-message');
            console.log(castInfo);
        }
    });
    logmsg('addChromecastHooks: added hooks');
};
