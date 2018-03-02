#!/bin/bash

if [ -f encrypt-settings.sh ] ; then
    source encrypt-settings.sh
else
    read -p "vid: " vid
    read -p "pid: " pid
    read -p "ser: " ser
    read -p "FILES: " FILES
    cat > encrypt-settings.sh <<EOT
vid="$vid"
pid="$pid"
ser="$ser"
FILES='$FILES'
EOT
fi

CFG=encrypt/encrypt-config.json
apikey=`uuidgen | tr -d '-'`

set -x

if [ -d content ] ; then
    read -p "'content' exists, remove it (y/N)? " _c
    if [ "$_c" == "y" ] ; then
        rm -r content || exit
    fi
fi

if [ ! -d content ] ; then
    cp -r content.orig content
fi

eval find content $FILES -delete

cat > $CFG <<EOT
{
    "vid": "$vid",
    "pid": "$pid",
    "mfg": "1",
    "prod": "2",
    "serial": "3",
    "descString1": "",
    "descString2": "",
    "descString3": "$ser",
    "apiKey": "$apikey",
    "encrypt": true,
    "inputPathTrim": "content.orig",
    "outputPathPrefix": "content",
EOT

eval find content.orig $FILES | ./encrypt/listfiles.sh >> $CFG
echo "}" >> $CFG

./encrypt/encrypt.js

export pwout="$vid:$pid:::$ser"
openssl req -x509 -newkey rsa:4096 -keyout cert/key.pem -out cert/cert.pem -days 3650 -passout env:pwout -config openssl.cnf
