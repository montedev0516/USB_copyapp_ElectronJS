//
// renderer
//

var cfg = require('./config.json');
global.$ = $;

const URL = "https://localhost:" + cfg.SERVER_PORT;

function checkLoad(retry) {
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
        console.log('Error reading statys, retry ' + retry);
        if (retry > 0) {
            setTimeout(() => {checkLoad(retry - 1)}, 333);
        } else {
            loadStat(locked);
        }
    });
}

var info =
`<div id="info">
    <div>Company Name</div>
    <div>Company Contact</div>
    <div>Company Email</div>
    <div>Company Website</div>
</div>`;
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
    console.log('Document loaded, jQuery booted.');
    loadStat(loading);

    $.ajax({ accepts: "application/json" });

    checkLoad(10);
});
