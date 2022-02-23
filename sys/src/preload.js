/* global window */
//
// preloaded by render process
//

const {
    ipcRenderer,
} = require('electron');

let usbCastTargetUrl;
let usbCastUUID;
let usbCastIP;
let usbjQuery;

if (typeof window.api === 'undefined') {
    window.api = {};
}

function logmsg(s) {
    if (window.logger) {
        window.logger.info(s);
    }
    // eslint-disable-next-line no-console
    console.log(s);
}
logmsg('loading preload.js');


window.api.addLogger = () => {
    const path = require('path'); // eslint-disable-line global-require
    const log4js = require('log4js'); // eslint-disable-line global-require
    const locator = ipcRenderer.sendSync('getlocator-message');

    if (typeof locator.logging !== 'undefined') {
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
            },
        });
        window.logger = log4js.getLogger('browser');
    } else {
        log4js.configure({
            appenders: { logs: { type: 'stderr' } },
            categories: {
                default: {
                    appenders: ['logs'],
                    level: 'error',
                },
            },
        });
        window.logger = log4js.getLogger();
    }
    logmsg('log4js started on page');
};

window.api.addDataHooks = (jQuery) => {
    jQuery("[data-openlocal='true']").click((ev) => {
        ev.preventDefault();
        // this will prevent triggering the onOpenUrl()
        // call below.
        ipcRenderer.send('openlocal-message', ev.target.href);
    });

    jQuery("[data-dlenabled='true']").click((ev) => {
        ipcRenderer.send('dlenabled-message', ev.target.href);
    });
    logmsg('addDataHooks: added hooks');
};

function runChromecast(targetUrl, uuid, ipaddr) {
    logmsg(`usbCast: target ${targetUrl} ${uuid}`);
    ipcRenderer.send('usbcast-message', {
        targetUrl,
        usbCastUUID: uuid,
        usbCastIP: ipaddr,
    });
}
window.api.runChromecast = runChromecast;

global.usbCastSelect = (el) => {
    logmsg('usbCastSelect: starting chromecast');
    const jqel = usbjQuery(el);
    const name = jqel.data('name');
    usbCastUUID = jqel.data('uuid');
    usbCastIP = jqel.data('address');
    logmsg(
        'usbCastSelect: ' +
        `${usbCastTargetUrl} ${name} ${usbCastUUID} ${usbCastIP}`,
    );
    runChromecast(usbCastTargetUrl, usbCastUUID, usbCastIP);
    jqel.parent().hide();
};

function configureCastSelectModal(selectModal, castInfo) {
    let content = '';
    if (castInfo.length === 0) {
        content = 'ERROR: no chromecast devices found';
    }
    castInfo.forEach((e) => {
        const el =
            "<div class='usbcastitem' onclick='usbCastSelect(this)'" +
            `data-name='${e.name}' data-uuid='${e.uuid}' ` +
            `data-address='${e.address}'` +
            '>' +
            e.name +
            '</div>';
        content += el;
    });
    selectModal.html(content);
}

function listChromecast() {
    const castInfo = ipcRenderer.sendSync('usbcastlist-message');
    logmsg('Received back IPC data:');
    logmsg(castInfo);
    return castInfo;
}
window.api.listChromecast = listChromecast;

window.api.addChromecastHooks = (jQuery) => {
    usbjQuery = jQuery;
    jQuery("[data-usbcast='true']").click((ev) => {
        logmsg('Starting click handler for data-usbcast');
        const targetUrl = ev.currentTarget.dataset.usbcastSource;
        const selectModal = ev.currentTarget.dataset.usbcastModal;
        if (targetUrl && usbCastUUID && usbCastIP) {
            runChromecast(targetUrl, usbCastUUID, usbCastIP);
        } else {
            usbCastTargetUrl = targetUrl;
            const castInfo = listChromecast();
            const modal = jQuery('#' + selectModal);
            configureCastSelectModal(modal, castInfo);
            modal.show();
        }
    });
    logmsg('addChromecastHooks: added hooks');
};
