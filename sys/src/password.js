const crypto = require('crypto');

exports.makepw = (serial, firmvers, salt, nonce) => {
    var bytes = new Buffer(crypto.randomBytes(2048));
    var s = new Buffer(serial + firmvers + salt + nonce);
    var res = [];
    var j = 0;
    for (var i = 0; i < bytes.length; i++) {
        if (j >= s.length) {
            j = 0;
        }
        res.push(bytes[i] ^ s[j]);
    }

    return new Buffer(res);
}

