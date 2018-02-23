//
// renderer
//

var cfg = require('./config.json');
global.$ = $;

const URL = "http://localhost:" + cfg.SERVER_PORT;

$(function(){
    console.log('Document loaded, jQuery booted.');


    $.ajax({ accepts: "application/json" });

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
    });

});
