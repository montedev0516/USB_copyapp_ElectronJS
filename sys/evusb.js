//
// renderer
//

var cfg = require('./config.json');
global.$ = $;

const URL="http://localhost:" + cfg.SERVER_PORT;

$(function(){
    console.log('Document loaded, jQuery booted.');


    $.ajax({ accepts: "application/json" });

    $.ajax(URL + '/status').done(function(data, textStatus, jqXHR) {
        $("#loading").text('Status: ' + data.status);
    });

});
