//
// Encryption Tool Controller
//

var encrypt = require('./encrypt');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

require('jquery-ui');
require('jquery-ui/ui/widgets/progressbar');

var maskCounter;
var conffile = path.join(os.homedir(), '.usbcopypro-encrypt.json');

function delMask(elid) {
    $(elid).remove();
}

// Add a mask to the display.
function newMaskHTML(name, i) {
    return "<div name='matchlist' id='matchrow_"+i+"'>" +
        "<span class='matchentry' " +
              "name='matchrow'>" +
        name +
        "</span>&nbsp;" +
        "<span class='xbtn' " +
              "onclick='ctl.delMask(\"#matchrow_"+i+"\")' " +
              "id='delmatch_"+i+"'>&times;</span>" +
        "</div>";
}

// Add the contents of the input box to the
// list of masks, and clear the box.
function addNewMask() {
    let el = $("input[name='newmask']");
    let nhtml = $('#matchlist').html() + newMaskHTML(el.val(), maskCounter);
    $('#matchlist').html(nhtml);
    el.val('');
    maskCounter++;

}

function saveUI() {
    var enccfg = {
        'vid': $("input[name='vid']").val(),
        'pid': $("input[name='pid']").val(),
        'descString1': '',
        'descString2': '',
        'descString3': $("input[name='serial']").val(),
        'inputPath': $("input[name='indir']").val(),
        'outputPath': $("input[name='outdir']").val(),
        'apiKey': crypto.randomBytes(32).toString('hex')
    };

    enccfg.filematch = [];
    let els = $("div[name='matchlist']");
    for (let i=0; i < els.length; i++) {
        enccfg.filematch.push($(els[i]).find("[name='matchrow']").text());
    }

    fs.writeFileSync(
        conffile,
        JSON.stringify(enccfg));
}

function loadUI(enccfg) {
    $("input[name='vid']").val(enccfg.vid);
    $("input[name='pid']").val(enccfg.pid);
    $("input[name='serial']").val(enccfg.descString3);
    $("input[name='indir']").val(enccfg.inputPath);
    $("input[name='outdir']").val(enccfg.outputPath);

    if (!enccfg.hasOwnProperty('filematch')) {
        enccfg.filematch = [];
    }

    let masks = '';
    for(let i=0; i < enccfg.filematch.length; i++) {
        masks = masks + newMaskHTML(enccfg.filematch[i], i);
    }
    maskCounter = enccfg.filematch.length;

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
    var enccfg;
    if (fs.existsSync(conffile)) {
        enccfg = require(conffile);
    } else {
        enccfg = {};
    }

    loadUI(enccfg);
});

module.exports.delMask = delMask;
module.exports.addNewMask = addNewMask;
