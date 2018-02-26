//
// renderer
//

var cfg = require('./config.json');
global.$ = $;

const URL = "https://localhost:" + cfg.SERVER_PORT;

function checkLoad(retry) {
    $.ajax(URL + '/status').done(function(data, textStatus, jqXHR) {
        if (data.running) {
            loadStat($passed);
        } else {
            loadStat($locked);
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
            loadStat($locked);
        }
    });
}

$(function(){
    console.log('Document loaded, jQuery booted.');

    $.ajax({ accepts: "application/json" });

    checkLoad(10);
});
