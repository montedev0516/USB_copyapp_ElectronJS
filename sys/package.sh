#!/bin/sh

mkdir out || exit

if [ -d out/dist ] ; then
    echo "out/dist not empty"
    exit 1
fi

set -x

tar cfJ out/content.tar.xz content/ bytes.dat .hidfil.sys

mkdir out/dist && cd out/dist

cp -L -r ../../node_modules .
mv node_modules/electron/dist electron.linux
rm -r node_modules/electron*
rm -r node_modules/.bin
cp ../../scripts/* .
tar xvf ../content.tar.xz
cp ../../*.js ../../evusb.html ../../config.json .
cp -r ../../src .

