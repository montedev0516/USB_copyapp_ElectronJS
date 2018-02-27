#!/bin/sh

[ ! -d out ] && mkdir out

set -x

tar cfJ out/content.tar.xz content/ bytes.dat .hidfil.sys

rm node_modules/file-browser node_modules/usb-detection*
rm -f package-lock.json

electron-forge package
cp -r ../repo/file-browser ./out/everyusb-linux-x64/resources/app/node_modules/
cp -r ../repo/node-usb-detection ./out/everyusb-linux-x64/resources/app/node_modules/usb-detection.linux
