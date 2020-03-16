//
// renderer
//

/* global $, window */
global.$ = $;

const info = '';

const locked =
`<div class="hw locked">
    <img src="img/locked.png" class="center" /> ${info}
</div>`;

/* eslint-disable-next-line no-unused-vars */
const passed =
`<div class="hw passed">
    <img src="img/passed.png" class="center" /> ${info}
</div>`;

const loading =
`<div class="hw loading">
    <img src="img/loading.png" class="center" /> ${info}
</div>`;

function loadStat(statusStr) {
    // expcects "locked", "passed" or "loading" as input. loading is default.
    $('#status').html(statusStr);
}

function checkLoad(cfg, retry) {
    const URL = 'https://localhost:' + cfg.SERVER_PORT;

    $.ajax(URL + '/status').done((data) => {

        if (data.running) {
            /* This causes the screen to flash before loading the
             * landing page.  Probably not necessary.
            loadStat(passed); */
        } else {

            const serial = `Support Code: ${data.serial}`;

            const lockedSerial =
            `<div class="hw locked">
                <img src="img/locked.png" class="center" /> ${info}
                <span class="center locked-serial">${serial}</span>
            </div>`;

            loadStat(lockedSerial);
            return;
        }
        if (cfg.fileBrowserEnabled) {
            window.location.replace(URL);
        } else {
            window.location.replace(cfg.LAUNCH_URL);
        }
    }).fail(() => {
        /* eslint-disable-next-line no-console */
        console.log('Error reading status, retry ' + retry);

        if (retry > 0) {
            setTimeout(() => { checkLoad(cfg, retry - 1); }, 500);
        } else {
            loadStat(locked);
        }
    });
}

$(() => {
    /* eslint-disable-next-line global-require */
    const { ipcRenderer } = require('electron');
    /* eslint-disable-next-line global-require */
    const path = require('path');
    const locator = ipcRenderer.sendSync('getlocator-message');
    /* eslint-disable-next-line global-require, import/no-dynamic-require */
    const cfg = require(path.join(locator.shared, 'usbcopypro.json'));

    /* eslint-disable-next-line no-console */
    console.log('Document loaded, jQuery booted.  Found app: ' + locator.app);
    loadStat(loading);

    $.ajax({ accepts: 'application/json' });

    setTimeout(() => { checkLoad(cfg, 15); }, 150);
});
