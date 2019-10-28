/* eslint-disable no-bitwise */

const crypto = require('crypto');

function makePassword(serial, firmvers, salt, apikey, bytes) {
    const s = Buffer.from(serial + firmvers + salt + apikey);
    const res = [];
    let j = 0;
    for (let i = 0; i < bytes.length; i++) {
        if (j >= s.length) {
            j = 0;
        }
        res.push(bytes[i] ^ s[j]);
        j++;
    }

    return Buffer.from(res);
}

exports.makeNewPassword = (serial, firmvers, salt, apikey) => {
    const bytes = Buffer.from(crypto.randomBytes(2048));
    return [bytes, makePassword(serial, firmvers, salt, apikey, bytes)];
};

exports.makePassword = makePassword;

function zeroPad(value, size) {
    const s = '0000' + value.trim().toLowerCase();
    return s.substr(s.length - size);
}

exports.getSerial = (enccfg, srvcfg) => (
    [
        zeroPad(enccfg.vid, 4),
        zeroPad(enccfg.pid, 4),
        enccfg.descString1,
        enccfg.descString2,
        enccfg.descString3.substr(0, srvcfg.serialLength),
    ].join(':')
);

exports.getVersion = (enccfg, srvcfg) => (
    [
        enccfg.mfg,
        enccfg.prod,
        srvcfg.useDeviceSerialNum ? enccfg.serial : 'X',
    ].join('.')
);
