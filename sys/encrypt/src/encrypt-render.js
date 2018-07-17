//
// Encryption Tool Controller
//

const encrypt = require('./encrypt');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

require('jquery-ui');
require('jquery-ui/ui/widgets/progressbar');

var maskCounter;
var conffile = path.join(os.homedir(), '.usbcopypro-encrypt.json');
var barHidden = true;

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
    if (el.val().length == 0) {
        return;
    }
    let nhtml = $('#matchlist').html() + newMaskHTML(el.val(), maskCounter);
    $('#matchlist').html(nhtml);
    el.val('');
    maskCounter++;

}

function saveUI() {
    let enccfg = {
        'vid': $("input[name='vid']").val(),
        'pid': $("input[name='pid']").val(),
        'mfg': 0, // unused
        'prod': 0, // unused
        'serial': 0, // unused
        'descString1': '', // unused
        'descString2': '', // unused
        'descString3': $("input[name='serial']").val(),
        'inputPath': $("input[name='indir']").val(),
        'outputPath': $("input[name='outdir']").val(),
        'workingPath': $("input[name='workdir']").val(),
        'apiKey': crypto.randomBytes(32).toString('hex')
    };

    // Always encrypt.
    enccfg.encrypt = true;

    enccfg.filematch = [];
    let els = $("div[name='matchlist']");
    for (let i=0; i < els.length; i++) {
        enccfg.filematch.push($(els[i]).find("[name='matchrow']").text());
    }

    fs.writeFileSync(
        conffile,
        JSON.stringify(enccfg));

    return enccfg;
}

function loadUI(enccfg) {
    $("input[name='vid']").val(enccfg.vid);
    $("input[name='pid']").val(enccfg.pid);
    $("input[name='serial']").val(enccfg.descString3);
    $("input[name='indir']").val(enccfg.inputPath);
    $("input[name='outdir']").val(enccfg.outputPath);
    $("input[name='workdir']").val(enccfg.workingPath);

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

    setBtnEnabled(true);
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

function encCallback(idx, total, isDone) {
    if (barHidden) {
        $('#progress').progressbar({ "max": total }).show();
        barHidden = false;
    }
    $('#progress').progressbar('option', 'value', idx);

    let hidx = idx + 1;
    messageCallback('Encrypting: ' + hidx + ' / ' + total);

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

    let hidx = idx + 1;
    messageCallback('Copying: ' + hidx + ' / ' + total);

    if (isDone) {
        messageCallback('Copying complete');
        barHidden = true;
        $('#progress').hide();
    }
}

function setBtnEnabled(val) {
    if (val) {
        $('#btn-encrypt')
            .removeClass('btndisabled')
            .addClass('btnenabled')
            .prop('disabled', false);
    } else {
        $('#btn-encrypt')
            .removeClass('btnenabled')
            .addClass('btndisabled')
            .prop('disabled', true);
    }
}

function runEncrypt() {
    let enccfg = saveUI();
    setBtnEnabled(false);
    $('#errors').hide();
    $('#messages').show();
    messageCallback('Starting...');
    setTimeout(() => {
        try {
            encrypt(enccfg, messageCallback, encCallback, unencCallback);
        } catch (e) {
            messageCallback('Exception!');
            messageCallback(e, true);
            setBtnEnabled(true);
        }
    }, 333);
}

$(function() {
    let enccfg;
    if (fs.existsSync(conffile)) {
        enccfg = require(conffile);
    } else {
        enccfg = {};
    }

    loadUI(enccfg);
});

module.exports.delMask = delMask;
module.exports.addNewMask = addNewMask;
