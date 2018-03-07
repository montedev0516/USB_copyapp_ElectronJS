//
// Encryption Tool Controller
//

var enccfg = require('./encrypt-config.json');
var encrypt = require('./encrypt');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('jquery-ui');
require('jquery-ui/ui/widgets/progressbar');

var maskCounter;

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
    enccfg.vid = $("input[name='vid']").val();
    enccfg.pid = $("input[name='pid']").val();
    enccfg.descString3 = $("input[name='serial']").val();
    enccfg.inputPath = $("input[name='indir']").val();
    enccfg.outputPath = $("input[name='outdir']").val();

    enccfg.apiKey = crypto.randomBytes(32).toString('hex');

    enccfg.filematch = [];
    let els = $("div[name='matchlist']");
    for (let i=0; i < els.length; i++) {
        enccfg.filematch.push($(els[i]).find("[name='matchrow']").text());
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
    display();
});

module.exports.delMask = delMask;
module.exports.addNewMask = addNewMask;
