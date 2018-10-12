const crypto = require('crypto');

function makePassword(serial, firmvers, salt, apikey, bytes) {
    var s = new Buffer(serial + firmvers + salt + apikey);
    var res = [];
    var j = 0;
    for (var i = 0; i < bytes.length; i++) {
        if (j >= s.length) {
            j = 0;
        }
        res.push(bytes[i] ^ s[j]);
        j++;
    }

    return new Buffer(res);
}

exports.makeNewPassword = (serial, firmvers, salt, apikey) => {
    var bytes = new Buffer(crypto.randomBytes(2048));
    return [bytes, makePassword(serial, firmvers, salt, apikey, bytes)];
}

exports.makePassword = makePassword;

function zeroPad(value, size) {
    var s = "0000" + value.trim().toLowerCase();
    return s.substr(s.length - size);
}

exports.getSerial = (enccfg, srvcfg) => {
    return [
        zeroPad(enccfg.vid, 4),
        zeroPad(enccfg.pid, 4),
        enccfg.descString1,
        enccfg.descString2,
        enccfg.descString3.substr(0, srvcfg.serialLength)].join(":");
}

exports.getVersion = (enccfg, srvcfg) => {
    return [
        enccfg.mfg,
        enccfg.prod,
        srvcfg.useDeviceSerialNum ?  enccfg.serial : 'X'].join(".");
}
