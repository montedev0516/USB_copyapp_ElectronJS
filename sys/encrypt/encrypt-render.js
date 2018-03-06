
var enccfg = require('./encrypt-config.json');
var enctool = require('./encrypt');

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

function runEncrypt() {
}


$(function() {
    display();
});
