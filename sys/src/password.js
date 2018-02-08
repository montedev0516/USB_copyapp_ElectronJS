const crypto = require('crypto');

function makePassword(serial, firmvers, salt, nonce, bytes) {
    var s = new Buffer(serial + firmvers + salt + nonce);
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

exports.makeNewPassword = (serial, firmvers, salt, nonce) => {
    var bytes = new Buffer(crypto.randomBytes(2048));
    return [bytes, makePassword(serial, firmvers, salt, nonce, bytes)];
}

exports.makePassword = makePassword;
