
var enccfg = require('./encrypt-config.json');
var encrypt = require('./encrypt');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('jquery-ui');
require('jquery-ui/ui/widgets/progressbar');

function addMask(name, i) {
    return "<span id='match_"+i+"' class='matchentry'>" +
        name +
        "</span><br/>";
}

function saveUI() {
    enccfg.vid = $("input[name='vid']").val();
    enccfg.pid = $("input[name='pid']").val();
    enccfg.descString3 = $("input[name='serial']").val();
    enccfg.inputPath = $("input[name='indir']").val();
    enccfg.outputPath = $("input[name='outdir']").val();

    enccfg.apiKey = crypto.randomBytes(32).toString('hex');

    enccfg.filematch = [];
    for (let i=0; ; i++) {
        let el = $('#match_'+i);
        if (el.length == 0) {
            break;
        }
        enccfg.filematch.push(el.text());
    }

    fs.writeFileSync(
        path.join(__dirname, 'encrypt-config.json'),
        JSON.stringify(enccfg));
}

function display() {
    $("input[name='vid']").val(enccfg.vid);
    $("input[name='pid']").val(enccfg.pid);
    $("input[name='serial']").val(enccfg.descString3);
    $("input[name='indir']").val(enccfg.inputPath);
    $("input[name='outdir']").val(enccfg.outputPath);

    let masks = '';
    for(let i=0; i<enccfg.filematch.length; i++) {
        masks = masks + addMask(enccfg.filematch[i], i);
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
    saveUI();
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
