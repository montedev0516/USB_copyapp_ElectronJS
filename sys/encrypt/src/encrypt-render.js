//
// Encryption Tool Controller
//

/* global $ */

const encrypt = require('./encrypt');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const vers = require('../package.json');

const { dialog } = require('electron').remote;

require('jquery-ui');
require('jquery-ui/ui/widgets/progressbar');

let maskCounter;
const conffile = path.join(os.homedir(), '.usbcopypro-encrypt.json');
let barHidden = true;
let workingPath = null;
let longVersion = '<unknown>';

function delMask(elid) {
    $(elid).remove();
}

// Add a mask to the display.
function newMaskHTML(name, i) {
    return '<div name="matchlist" id="matchrow_' + i + '">' +
        '<span class="matchentry" ' +
              'name="matchrow">' +
        name +
        '</span>&nbsp;' +
        '<span class="xbtn" ' +
              'onclick="ctl.delMask(\\"#matchrow_" + i + "\\")" ' +
              'id="delmatch_' + i + '">&times;</span>' +
        '</div>';
}

// Add the contents of the input box to the
// list of masks, and clear the box.
function addNewMask() {
    const el = $("input[name='newmask']");
    if (el.val().length === 0) {
        return;
    }
    const nhtml = $('#matchlist').html() + newMaskHTML(el.val(), maskCounter);
    $('#matchlist').html(nhtml);
    el.val('');
    maskCounter++;
}

function saveUI() {
    workingPath = $("input[name='workdir']").val();

    const enccfg = {
        vid: $("input[name='vid']").val(),
        pid: $("input[name='pid']").val(),
        mfg: 0, // unused
        prod: 0, // unused
        serial: 0, // unused
        descString1: '', // unused
        descString2: '', // unused
        descString3: $("input[name='serial']").val(),
        inPath: $("input[name='indir']").val(),
        outPath: $("input[name='outdir']").val(),
        workPath: workingPath,
        apiKey: crypto.randomBytes(32).toString('hex'),
        version: longVersion,
    };

    // Always encrypt.
    enccfg.encrypt = true;

    enccfg.filematch = [];
    const els = $('div[name="matchlist"]');
    for (let i = 0; i < els.length; i++) {
        enccfg.filematch.push($(els[i]).find('[name="matchrow"]').text());
    }

    fs.writeFileSync(
        conffile,
        JSON.stringify(enccfg),
    );

    return enccfg;
}

function messageCallback(s, isError) {
    if (isError) {
        $('#errors')
            .show()
            .html(s);
    } else if (s) {
        $('#messages')
            .html(s);
    } else {
        $('#messages')
            .html('')
            .hide();
        $('#errors')
            .html('')
            .hide();
    }
}

function validatePath(somePath, anotherPath, yetAnotherPath, desc) {
    if (somePath.trim().length === 0) {
        messageCallback('Please enter the ' + desc + ' directory', true);
        return false;
    }

    if (somePath.trim() === anotherPath.trim() || somePath.trim() === yetAnotherPath.trim()) {
        messageCallback('The ' + desc + ' directory should be different from the other two directories', true);
        return false;
    }

    return true;
}

function checkDirectoryEmpty(dir, desc) {
    let ok = true;

    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);

        if (files.length > 0) {
            ok = false;

            messageCallback('The ' + desc + ' directory should be empty', true);
        }
    }

    return ok;
}

function checkDirectoryNotEmpty(dir, desc) {
    let ok = true;

    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);

        if (files.length == 0) {
            ok = false;

            messageCallback('The ' + desc + ' directory should not be empty', true);
        }
    }

    return ok;
}

function isAlphaNumeric(ch) {
	return ch.match(/^[a-f0-9]+$/i) !== null;
}

function validateNumber(num, desc) {
    const value = num.trim().toLowerCase();

    if (value === '') {
        messageCallback('The ' + desc + ' should not be empty', true);
        return false;
    }

    if (value.length > 4) {
        messageCallback('The ' + desc + ' should not be longer than 4 chars', true);
        return false;
    }

    if (!isAlphaNumeric(value)) {
        messageCallback('The ' + desc + ' should only contain hex chars: letters (a to f) or digits', true);
        return false;
    }

    if (value > 'ffff') {
        messageCallback('The ' + desc + ' should not exceed the value "ffff"', true);
        return false;
    }

    return true;
}

function validate(enccfg) {
    const inPath = enccfg.inPath || '';
    const outPath = enccfg.outPath || '';
    const workPath = enccfg.workPath || '';

    let ok = true;

    messageCallback(false);

    ok = ok && validateNumber(enccfg.vid || '', 'VID');
    ok = ok && validateNumber(enccfg.pid || '', 'PID');

    ok = ok && validatePath(inPath, outPath, workPath, 'input');
    ok = ok && validatePath(workPath, inPath, outPath, 'working');
    ok = ok && validatePath(outPath, inPath, workPath, 'output');

    ok = ok && checkDirectoryEmpty(workPath, 'working');
    ok = ok && checkDirectoryNotEmpty(inPath, 'input');

    return ok;
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

function encCallback(idx, total, isDone) {
    if (barHidden) {
        $('#progress').progressbar({ max: total }).show();
        barHidden = false;
    }
    $('#progress').progressbar('option', 'value', idx);

    const hidx = idx + 1;
    messageCallback('Encrypting: ' + hidx + ' / ' + total);

    if (isDone) {
        messageCallback('Encrypting complete');
        barHidden = true;
        $('#progress').hide();
    }
}

function unencCallback(idx, total, isDone) {
    if (barHidden) {
        $('#progress').progressbar({ max: total }).show();
        barHidden = false;
    }
    $('#progress').progressbar('option', 'value', idx);

    const hidx = idx + 1;
    messageCallback('Copying: ' + hidx + ' / ' + total);

    if (isDone) {
        messageCallback('Copying complete');
        barHidden = true;
        $('#progress').hide();
    }
}

function toggleButton(val) {
    setBtnEnabled(true);

    if (val) {
        $('#btn-encrypt')
            .text('Done, continue ...')
            // eslint-disable-next-line no-use-before-define
            .off('click', runEncrypt)
            // eslint-disable-next-line no-use-before-define
            .on('click', doContinue);
    } else {
        $('#btn-encrypt')
            .text('Encrypt!')
            // eslint-disable-next-line no-use-before-define
            .off('click', doContinue)
            // eslint-disable-next-line no-use-before-define
            .on('click', runEncrypt);
    }
}

function doneCallback() {
    toggleButton(true);
}

function runEncrypt() {
    const enccfg = saveUI();

    if (validate(enccfg)) {
        setBtnEnabled(false);
        $('#errors').hide();
        $('#messages').show();
        messageCallback('Starting...');

        setTimeout(() => {
            try {
                encrypt(enccfg, messageCallback, encCallback, unencCallback, doneCallback);
            } catch (e) {
                messageCallback('Exception!');
                messageCallback(e, true);
                doneCallback();
            }
        }, 333);
    }
}

function chooseFile(inputEl, desc) {
    const chooseFileFn = () => {
        const currentpath = $("input[name='" + inputEl + "']").val();

        const paths = dialog.showOpenDialog({
            title: 'Select the ' + desc + ' directory',
            defaultPath: currentpath,
            properties: ['openDirectory'],
        });

        if (paths && paths.length === 1) {
            $("input[name='" + inputEl + "']").val(paths[0]);
        }
    };

    return chooseFileFn;
}

function askClearWorkingDir(inputEl, desc) {

    const askClearWorkingDirFn = () => {

        workingPath = $("input[name='workdir']").val();

        const choice = dialog.showMessageBox({
            type: "question",
            buttons: ['Yes', 'No'],
            defaultId: 0,
            title: 'Clear the working dir?',
            message: 'Are you sure you want to clear the working dir ("' + workingPath + '") ?'
        });

        if (choice == 0) {  // yes

            if (workingPath) {

                if (clearWorkingDir(workingPath)) {

                    dialog.showMessageBox({
                        type: "info",
                        buttons: ['OK'],
                        title: 'Working dir was cleared',
                        message: 'The working dir was cleared successfully'
                    });

                } else {
                    dialog.showMessageBox({
                        type: "warning",
                        buttons: ['OK'],
                        title: 'Working dir not cleared',
                        message: 'The working dir was already empty, or it does not exist'
                    });
                }

            } else {
                dialog.showMessageBox({
                    type: "warning",
                    buttons: ['OK'],
                    title: 'Working dir not defined',
                    message: 'The working dir is not defined yet'
                });
            }
        }
    };

    return askClearWorkingDirFn;
}

function loadUI(enccfg) {
    // version
    try {
        const tag = fs.readFileSync(path.join(__dirname, '../.usbgittag'));
        longVersion = vers.version + '+' + tag;
    } catch (e) {
        longVersion = vers.version + '+DEV';
    }

    $('#version-info').text('Version: ' + longVersion);

    // backwards compatibility
    if (enccfg.hasOwnProperty('inputPath')) {
        // eslint-disable-next-line no-param-reassign
        enccfg.inPath = enccfg.inputPath;
    }
    if (enccfg.hasOwnProperty('outputPath')) {
        // eslint-disable-next-line no-param-reassign
        enccfg.workPath = enccfg.outputPath;
    }
    if (enccfg.hasOwnProperty('workingPath')) {
        // eslint-disable-next-line no-param-reassign
        enccfg.outPath = enccfg.workingPath;
    }

    $('input[name="vid"]').val(enccfg.vid);
    $('input[name="pid"]').val(enccfg.pid);
    $('input[name="serial"]').val(enccfg.descString3);
    $('input[name="indir"]').val(enccfg.inPath);
    $('input[name="outdir"]').val(enccfg.outPath);
    $('input[name="workdir"]').val(enccfg.workPath);

    if (!enccfg.hasOwnProperty('filematch')) {
        // eslint-disable-next-line no-param-reassign
        enccfg.filematch = [];
    }

    let masks = '';
    for (let i = 0; i < enccfg.filematch.length; i++) {
        masks += newMaskHTML(enccfg.filematch[i], i);
    }
    maskCounter = enccfg.filematch.length;

    $('#matchlist').html(masks);

    $('#btn-encrypt')
        .on('click', runEncrypt);

    setBtnEnabled(true);

    $('#btn-select-indir').on('click', chooseFile('indir', 'input'));
    $('#btn-select-workdir').on('click', chooseFile('workdir', 'working'));
    $('#btn-clear-workdir').on('click', askClearWorkingDir('workdir', 'working'));
    $('#btn-select-outdir').on('click', chooseFile('outdir', 'output'));
}

function clearDir(directory, removeDir) {
    let ok;
    const files = fs.readdirSync(directory);

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fullPath = path.join(directory, file);
        const stats = fs.statSync(fullPath);

        if (stats.isFile()) {
            fs.unlinkSync(fullPath);
            ok = true;
        } else if (stats.isDirectory()) {
            ok = clearDir(fullPath, true);
        } else {
            ok = false;
        }

        if (!ok) {
            break;
        }
    }

    if (ok && removeDir) {
        fs.rmdirSync(directory);
    }

    return ok;
}

function clearWorkingDir(directory) {
    
    if (directory && directory.trim().length > 3 && fs.existsSync(directory)) {
        messageCallback('Clearing working dir ...');

        clearDir(directory, false);

        return true;
    }

    return false;
}

function doContinue() {
    setBtnEnabled(false);

    if (workingPath) {
        clearWorkingDir(workingPath);

        workingPath = null;
    }

    setTimeout(() => {
        // clear the output message
        messageCallback(false);

        toggleButton(false);
    }, 800);
}

$(() => {
    let enccfg;
    if (fs.existsSync(conffile)) {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        enccfg = require(conffile);
    } else {
        enccfg = {};
    }

    loadUI(enccfg);
});

module.exports.delMask = delMask;
module.exports.addNewMask = addNewMask;
