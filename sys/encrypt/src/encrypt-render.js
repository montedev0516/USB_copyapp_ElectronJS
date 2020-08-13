//
// Encryption Tool Controller
//

/* global $ */
/* global document */

const encrypt = require('./encrypt');
const fs = require('original-fs');
const fsextra = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const tmp = require('tmp');
const vers = require('../package.json');
const { execFile } = require('child_process');
const { dialog } = require('electron').remote;

require('jquery-ui');
require('jquery-ui/ui/widgets/progressbar');

let maskCounter;
const conffile = path.join(os.homedir(), '.usbcopypro-encrypt.json');
let barHidden = true;
let longVersion = '<unknown>';
let presets;
let ignoreSpaceWarnings = false;

// working dir (tmp object) for temp data
let workingDirObj;
tmp.setGracefulCleanup();

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
              'onclick=\'ctl.delMask("#matchrow_' + i + '")\' ' +
              'id="delmatch_' + i + '">&times;</span>' +
        '</div>';
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
            .html('');
        $('#errors')
            .html('')
            .hide();
    }
}

function saveUI() {
    $('#btn-save-config')[0].innerHTML = 'Saving...';

    const pname = $("input[name='save-as']").val();
    const vid = $("input[name='vid']").val();
    const pid = $("input[name='pid']").val();
    const descString3 = $("input[name='serial']").val();
    const sysPath = $('#system-info').text();

    if (typeof pname !== 'undefined' && pname.trim().length !== 0) {
        presets[pname.trim()] = { vid, pid, descString3 };
    }

    const enccfg = {
        vid,
        pid,
        mfg: 0, // unused
        prod: 0, // unused
        serial: 0, // unused
        descString1: '', // unused
        descString2: '', // unused
        descString3,
        inPath: $("input[name='indir']").val(),
        outPath: $("input[name='outdir']").val(),
        apiKey: crypto.randomBytes(32).toString('hex'),
        version: longVersion,
        sysPath: sysPath,
        presets,
    };

    // Always encrypt.
    enccfg.encrypt = true;

    enccfg.filematch = [];
    const els = $('div[name="matchlist"]');
    for (let i = 0; i < els.length; i++) {
        enccfg.filematch.push($(els[i]).find('[name="matchrow"]').text());
    }

    enccfg.fileBrowserEnabled = $('#fileBrowserEnabled').prop('checked');

    fs.writeFileSync(
        conffile,
        JSON.stringify(enccfg),
    );

    setTimeout(() => {
        $('#btn-save-config')[0].innerHTML = 'Save';
    }, 300);

    return enccfg;
}

function btnFinalizeClick() {
    const enccfg = saveUI();

    if (!enccfg.sysPath) {
        messageCallback('ERROR: no system path', true);
        return;
    }

    const sysFullPath = path.join(enccfg.sysPath, 'app');

    messageCallback('Copying system<br>' +
        sysFullPath + ' -><br>' +
        enccfg.outPath);

    try {
        process.noAsar = true;
        fsextra.copy(sysFullPath, enccfg.outPath, err => {
            process.noAsar = false;
            if (err) {
                messageCallback(err, true);
            } else {
                messageCallback('Copy complete');
            }
        });

        const locData = {
            shared: './shared',
            app: './sys/resources/app.asar',
            drive: '.\\drive\\sys\\usbcopypro-win32-ia32\\usbcopypro.exe',
        };
        const locPath = path.join(enccfg.outPath, 'locator.json');
        fs.writeFileSync(locPath, JSON.stringify(locData));
    } catch (e) {
        messageCallback('Copy sys ERROR: ' + e.message, true);
        throw e;
    }
}

function findExecPath(enccfg) {
    const execPaths = [
        path.join(enccfg.sysPath,
            'app', 'sys', 'usbcopypro-win32-ia32', 'usbcopypro.exe',
        ),
        path.join(enccfg.sysPath,
            'app', 'drive', 'sys', 'usbcopypro-win32-ia32', 'usbcopypro.exe',
        ),
        path.join(enccfg.sysPath,
            'app', 'sys', 'usbcopypro-linux-x64', 'usbcopypro',
        ),
    ];

    for (let i = 0; i < execPaths.length; i++) {
        if (fs.existsSync(execPaths[i])) {
            return execPaths[i];
        }
    }

    // return something for the error message
    return execPaths[0];
}

function btnLaunchClick() {
    const tempLocator = tmp.fileSync();
    const enccfg = saveUI();

    if (!enccfg.sysPath) {
        messageCallback('ERROR: no system path', true);
        return;
    }

    const execPath = findExecPath(enccfg);
    const appPath = path.join(enccfg.sysPath,
        'app', 'sys', 'resources', 'app.asar',
    );

    if (!fs.existsSync(execPath)) {
        messageCallback('ERROR: executable not found "' + execPath + '"', true);
        return;
    }

    messageCallback(
        'Launching test application with encrypted data</br>' +
        'Locator: ' + tempLocator.name + '</br>' +
        'Executable: ' + execPath,
    );

    const sharedPath = path.join(enccfg.outPath, 'shared');
    const locData = {
        shared: sharedPath,
        app: appPath,
        drive: '.\\drive\\sys\\usbcopypro-win32-ia32\\usbcopypro.exe',
    };

    try {
        const serverCfg = JSON.parse(fs.readFileSync(
            path.join(sharedPath, 'usbcopypro.json')));
        fs.writeFileSync(tempLocator.fd, JSON.stringify(locData));
        const salt = serverCfg.salt;

        if (!salt) {
            throw new Error('ERROR: usbcopypro.json is invalid');
        }

        const algorithm = 'aes-192-cbc';
        const password = crypto.randomBytes(16).toString('hex');
        const encpass = Buffer.from(password + 'dd' + salt, 'hex');
        const vid = enccfg.vid;
        const pid = enccfg.pid;
        const serial = enccfg.descString3;

        const cipher = crypto.createCipher(algorithm, encpass);

        const device = {
            vendorId: parseInt(vid, 16),
            productId: parseInt(pid, 16),
            serialNumber: serial,
        };

        let enc = cipher.update(JSON.stringify(device), 'utf8', 'hex');
        enc += cipher.final('hex');

        const newenv = Object.assign({
            ENCTOOLBACKPW: password,
            ENCTOOLBACK: enc,
            ENCTOOLLOC: tempLocator.name,
        }, process.env);

        const child = execFile(execPath, [], {
            env: newenv,
        }, (error, stdout, stderr) => {
            messageCallback('Process finished');
            if (error) {
                messageCallback(error, true);
            } else {
                const s = '<pre>' + stdout + stderr + '</pre>';
                messageCallback(s);
            }
        });

        if (!child) {
            messageCallback('ERROR spaning process', true);
        }
    } catch (e) {
        messageCallback('Launch ERROR: ' + e.message, true);
        throw e;
    }
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

function validatePath(somePath, anotherPath, yetAnotherPath, desc) {
    if (somePath.trim().length === 0) {
        messageCallback('Please enter the ' + desc + ' directory', true);
        return false;
    }

    if (somePath.trim() === anotherPath.trim() || somePath.trim() === yetAnotherPath.trim()) {
        messageCallback('The ' + desc + ' directory should be different from the other two directories', true);
        return false;
    }

    if (!fs.existsSync(somePath)) {
        fs.mkdirSync(somePath, { recursive: true });
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

        if (files.length === 0) {
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

function doneCallback(runAborted) {
    if (workingDirObj) {
        messageCallback('Clearing working dir...');
        workingDirObj.removeCallback();
        workingDirObj = undefined;
    }
    messageCallback('Encryption complete');

    // eslint-disable-next-line no-use-before-define
    toggleButton(true);

    if (runAborted) {
        barHidden = true;
        messageCallback('The run was aborted');
        $('#progress').hide();
    }
}

function checkSpaceCallback(message) {
    // ignore all further space warnings - don't show warning and return true ("continue")
    if (ignoreSpaceWarnings) {
        return true;
    }

    const choice = dialog.showMessageBoxSyncSync({
        type: 'question',
        buttons: ['Stop', 'Continue', 'Ignore all'],
        defaultId: 0,
        title: 'Limited disk space',
        message,
    });

    let ok;

    if (choice === 0) { // stop
        ok = false;
    } else if (choice === 1) { // continue
        ok = true;
    } else if (choice === 2) { // ignore all
        ok = true;
        ignoreSpaceWarnings = true;
    }

    return ok;
}

function changeFileBrowserEnabled() {
    const fileBrowserEnabled = $('#fileBrowserEnabled').prop('checked');
    $('#displayFileBrowserEnabled')
        .text(fileBrowserEnabled ? 'enabled' : 'disabled');
}

function runEncrypt() {
    try {
        const enccfg = saveUI();

        if (workingDirObj !== undefined) {
            messageCallback('Clearing working dir...');
            workingDirObj.removeCallback();
            workingDirObj = undefined;
        }
        workingDirObj = tmp.dirSync({ unsafeCleanup: true });
        enccfg.workPath = workingDirObj.name;

        if (validate(enccfg)) {
            setBtnEnabled(false);
            $('#errors').hide();
            messageCallback('Starting...');

            setTimeout(() => {
                try {
                    // reset "check space ignore warnings" flag for this session
                    ignoreSpaceWarnings = false;

                    encrypt(
                        enccfg, messageCallback, encCallback,
                        unencCallback, doneCallback, checkSpaceCallback,
                    );
                } catch (e) {
                    messageCallback('Exception running encryption!');
                    messageCallback(e, true);
                    doneCallback(false);
                }
            }, 333);
        }
    } catch (e) {
        messageCallback('Exception during setup!');
        messageCallback(e, true);
        doneCallback(false);
    }
}

function doContinue() {
    setBtnEnabled(false);

    setTimeout(() => {
        // clear the output message
        messageCallback(false);

        // eslint-disable-next-line no-use-before-define
        toggleButton(false);
    }, 800);
}

function toggleButton(val) {
    setBtnEnabled(true);

    if (val) {
        $('#btn-encrypt')
            .text('Done, continue ...')
            .off('click')
            .on('click', doContinue);
    } else {
        $('#btn-encrypt')
            .text('Encrypt!')
            .off('click')
            .on('click', runEncrypt);
    }
}

function chooseFile(inputEl, desc) {
    const currentpath = $("input[name='" + inputEl + "']").val();

    const paths = dialog.showOpenDialog({
        title: 'Select the ' + desc + ' directory',
        defaultPath: currentpath,
        properties: ['openDirectory'],
    });

    if (paths && paths.length === 1) {
        $("input[name='" + inputEl + "']").val(paths[0]);
    }
}

function clearDir(directory, removeDir) {
    let ok = false;
    try {
        const files = fs.readdirSync(directory);
        ok = (files.length === 0);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fullPath = path.join(directory, file);
            const stats = fs.statSync(fullPath);

            // Program a workaround/exception, for the ASAR files, because
            // on some systems (OSX ?) it "thinks" that the .asar file is
            // a directory ...
            if (stats.isFile() || file.endsWith('.asar')) {
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
    } catch (e) {
        messageCallback(e, true);
        ok = false;
    }

    return ok;
}

function clearOutputDir(directory) {
    if (directory && directory.trim().length > 3 && fs.existsSync(directory)) {
        messageCallback('Clearing output dir ...');

        return clearDir(directory, false);
    }

    return false;
}

function askClearOutputDir() {
    const outPath = $("input[name='outdir']").val();

    const choice = dialog.showMessageBoxSync({
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 0,
        title: 'Clear the output dir?',
        message: 'Are you sure you want to clear the output dir ("' +
                 outPath + '") ?',
    });

    if (choice === 0) { // yes
        if (outPath) {
            if (clearOutputDir(outPath)) {
                dialog.showMessageBoxSync({
                    type: 'info',
                    buttons: ['OK'],
                    title: 'Output dir was cleared',
                    message: 'The output dir was cleared successfully',
                });
                messageCallback('Output dir cleared');
            } else {
                dialog.showMessageBoxSync({
                    type: 'warning',
                    buttons: ['OK'],
                    title: 'Output dir not cleared',
                    message: 'Failed to clear output dir',
                });
            }
        } else {
            dialog.showMessageBoxSync({
                type: 'warning',
                buttons: ['OK'],
                title: 'Output dir not defined',
                message: 'The output dir is not defined yet',
            });
        }
    }
}

function loadUIParams(enccfg) {
    $('input[name="vid"]').val(enccfg.vid);
    $('input[name="pid"]').val(enccfg.pid);
    $('input[name="serial"]').val(enccfg.descString3);
}

function restorePreset() {
    const restorePresetFn = () => {
        const v = $('#presets-select').val();
        if (typeof v === 'undefined' || v === '') {
            return;
        }
        const p = presets[v];

        if (typeof p === 'undefined') {
            return;
        }

        const enccfg = {};
        enccfg.vid = p.vid;
        enccfg.pid = p.pid;
        enccfg.descString3 = p.descString3;

        loadUIParams(enccfg);
        $("input[name='save-as']").val(v);
    };
    return restorePresetFn;
}

function getSystemPath(sysPath) {
    const checkList = [
        sysPath,
        '/usr/share/usbcopypro',
        '/usr/local/share/usbcopypro',
        'C:/Program Files/usbcopypro',
        'C:/Program Files (x86)/usbcopypro',
    ];
    for (let i = 0; i < checkList.length; i++) {
        if (checkList[i] !== undefined) {
            const checkFile = path.join(checkList[i], 'locator.json');
            if (fs.existsSync(checkFile)) {
                return checkList[i];
            }
        }
    }
    return undefined;
}

function checkSetSystemPath(enccfg) {
    const sysPath = getSystemPath(enccfg.sysPath);
    $('#system-info').text(sysPath || 'SYSTEM NOT FOUND');
    const ret = Object.assign({ sysPath }, enccfg);
    if (sysPath) {
        $('#btn-launch')
            .addClass('btnenabled')
            .on('click', btnLaunchClick);
        $('#btn-finalize')
            .addClass('btnenabled')
            .on('click', btnFinalizeClick);
    } else {
        $('#btn-launch')
            .addClass('btndisabled')
            .off('click');
        $('#btn-finalize')
            .addClass('btndisabled')
            .off('click');
    }
    return ret;
}

function loadUI(enccfgIn) {
    $('#btn-encrypt').off('click');
    $('#btn-select-indir').off('click');
    $('#btn-select-outdir').off('click');
    $('#btn-clear-outdir').off('click');
    $('#btn-save-config').off('click');
    $('#presets-select').off('change');
    $('#fileBrowserEnabled').off('change');

    $('#messages').show();
    // version
    try {
        const tag = fs.readFileSync(path.join(__dirname, '../.usbgittag'));
        longVersion = vers.version + '+' + tag;
    } catch (e) {
        longVersion = vers.version + '+DEV';
    }

    $('#version-info').text(longVersion);

    // location of the content app installed on the system
    const enccfg = checkSetSystemPath(enccfgIn);

    if (typeof enccfg.presets === 'undefined') {
        presets = {};
    } else {
        ({ presets } = enccfg);
    }

    const keys = Object.keys(presets);
    const jqselect = $('#presets-select');
    jqselect.empty();
    jqselect.append('<option value="">Presets...</option>');
    for (let i = 0; i < keys.length; i++) {
        if (keys[i].trim().length === 0) {
            delete presets[keys[i]];
        } else {
            const opt = document.createElement('option');
            opt.innerHTML = keys[i];
            opt.value = keys[i];
            jqselect[0].appendChild(opt);
        }
    }

    // backwards compatibility
    if (enccfg.hasOwnProperty('inputPath')) {
        // eslint-disable-next-line no-param-reassign
        enccfg.inPath = enccfg.inputPath;
    }
    if (enccfg.hasOwnProperty('outputPath')) {
        // eslint-disable-next-line no-param-reassign
        enccfg.workPath = enccfg.outputPath;
    }

    loadUIParams(enccfg);
    $('input[name="indir"]').val(enccfg.inPath);
    $('input[name="outdir"]').val(enccfg.outPath);

    if (!enccfg.hasOwnProperty('filematch')) {
        // eslint-disable-next-line no-param-reassign
        enccfg.filematch = [];
    }

    const fileBrowserEnabled = enccfg.hasOwnProperty('fileBrowserEnabled') && enccfg.fileBrowserEnabled === true;

    $('#displayFileBrowserEnabled').text(fileBrowserEnabled ? 'enabled' : 'disabled');
    $('#fileBrowserEnabled').prop('checked', fileBrowserEnabled);

    let masks = '';
    for (let i = 0; i < enccfg.filematch.length; i++) {
        masks += newMaskHTML(enccfg.filematch[i], i);
    }
    maskCounter = enccfg.filematch.length;

    $('#matchlist').html(masks);

    $('#fileBrowserEnabled').change(changeFileBrowserEnabled);

    $('#btn-encrypt')
        .on('click', runEncrypt);

    setBtnEnabled(true);

    $('#btn-select-indir').on('click', () => {
        chooseFile('indir', 'input');
    });
    $('#btn-select-outdir').on('click', () => {
        chooseFile('outdir', 'output');
    });
    $('#btn-clear-outdir').on('click', () => {
        askClearOutputDir();
    });
    $('#btn-save-config').on('click', () => {
        const cfg = saveUI();
        loadUI(cfg);
    });
    $('#presets-select').on('change', restorePreset());

    messageCallback('Encryption Tool version ' + longVersion + ' ready');
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
