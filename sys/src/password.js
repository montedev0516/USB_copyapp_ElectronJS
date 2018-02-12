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

exports.getSerial = (enccfg, descLength) => {
    return [
        enccfg.vid,
        enccfg.pid,
        enccfg.descString1,
        enccfg.descString2,
        enccfg.descString3.substr(0, descLength)].join(":");
}

exports.getVersion = (enccfg) => {
    return [
        enccfg.mfg,
        enccfg.prod,
        enccfg.serial].join(".");
}
