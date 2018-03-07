
var enccfg = require('./encrypt-config.json');
var encrypt = require('./encrypt');

require('jquery-ui');
require('jquery-ui/ui/widgets/progressbar');

function addMask(name) {
    return "<span class='matchentry'>" + 
        name +
        "</span><br/>";
}

function display() {
    $("input[name='vid']").val(enccfg.vid);
    $("input[name='pid']").val(enccfg.pid);
    $("input[name='serial']").val(enccfg.descString3);
    $("input[name='indir']").val(enccfg.inputPath);
    $("input[name='outdir']").val(enccfg.outputPath);

    let masks = '';
    for(let i=0; i<enccfg.filematch.length; i++) {
        masks = masks + addMask(enccfg.filematch[i]);
    }

    $('#matchlist').html(masks);

    $('#btn-encrypt').click(runEncrypt);
}

function messageCallback(s, isError) {
    if (isError) {
        $('#errors')
            .show()
            .html(s);
    } else {
        $('#messages')
            .html(s);
    }
}

var barHidden = true;

function encCallback(idx, total, isDone) {
    if (barHidden) {
        $('#progress').progressbar({ "max": total }).show();
        barHidden = false;
    }
    $('#progress').progressbar('option', 'value', idx);

    if ((idx % Math.round(total/100)) == 0) {
        messageCallback('Encrypting: ' + idx + ' / ' + total);
    }

    if (isDone) {
        messageCallback('Encrypting complete');
        barHidden = true;
        $('#progress').hide();
    }
}

function unencCallback(idx, total, isDone) {
    if (barHidden) {
        $('#progress').progressbar({ "max": total }).show();
        barHidden = false;
    }
    $('#progress').progressbar('option', 'value', idx);

    if ((idx % Math.round(total/100)) == 0) {
        messageCallback('Copying: ' + idx + ' / ' + total);
    }

    if (isDone) {
        messageCallback('Copying complete');
        barHidden = true;
        $('#progress').hide();
    }
}

function runEncrypt() {
    $('#btn-encrypt')
        .css('background-color', 'gray')
        .css('cursor', 'auto')
        .prop('disabled', true);
    messageCallback('Starting...');
    setTimeout(() => {
        encrypt(enccfg, messageCallback, encCallback, unencCallback);
    }, 333);
}

$(function() {
    display();
});
