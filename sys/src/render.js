//
// renderer
//

global.$ = $;

function checkLoad(cfg, retry) {
    var URL = "https://localhost:" + cfg.SERVER_PORT;
    $.ajax(URL + '/status').done(function(data, textStatus, jqXHR) {
        if (data.running) {
            /* This causes the screen to flash before loading the
             * landing page.  Probably not necessary. 
            loadStat(passed); */
        } else {
            loadStat(locked);
            return;
        }
        if (cfg.fileBrowserEnabled) {
            window.location.replace(URL);
        } else {
            window.location.replace(cfg.LAUNCH_URL);
        }
    }).fail(function(jqXHR, textStatus, err) {
        console.log('Error reading status, retry ' + retry);
        if (retry > 0) {
            setTimeout(() => {checkLoad(cfg, retry - 1)}, 500);
        } else {
            loadStat(locked);
        }
    });
}

var info ='';
var locked =
`<div class="hw locked">
    <img src="img/locked.png" class="center" /> ${info}
</div>`;
var passed =
`<div class="hw passed">
    <img src="img/passed.png" class="center" /> ${info}
</div>`;
var loading =
`<div class="hw loading">
    <img src="img/loading.png" class="center" /> ${info}
</div>`;

function loadStat(statusStr) {
    //expcects "locked", "passed" or "loading" as input. loading is default.
    $('#status').html(statusStr);
}

$(function(){
    const {ipcRenderer} = require('electron');
    const path = require('path');
    var locator = ipcRenderer.sendSync('getlocator-message');
    var cfg = require(path.join(locator.shared, 'usbcopypro.json'));

    console.log('Document loaded, jQuery booted.  Found app: ' + locator.app);
    loadStat(loading);

    $.ajax({ accepts: "application/json" });

    setTimeout(() => {checkLoad(cfg, 15)}, 150);
});
