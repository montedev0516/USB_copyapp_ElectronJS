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
        $("#loading").html(
            'Status: ' + data.status + '<br/>' +
            '<a href="' + cfg.LAUNCH_URL + '">Launch</a>'
        )
    });

});
