#!/bin/sh

[ ! -d out ] && mkdir out

set -x

tar cfJ out/content.tar.xz content/ bytes.dat .hidfil.sys

rm node_modules/file-browser node_modules/usb-detection*
rm -f package-lock.json

cmd /c electron-forge package
if [ -d ./out/everyusb-linux-x64 ] ; then
    cp -r ../repo/file-browser ./out/everyusb-linux-x64/resources/app/node_modules/
    cp -r ../repo/node-usb-detection ./out/everyusb-linux-x64/resources/app/node_modules/usb-detection.linux
else
    cp -r ../repo/file-browser ./out/everyusb-win32-ia32/resources/app/node_modules/
    cp -r ../repo/node-usb-detection ./out/everyusb-win32-ia32/resources/app/node_modules/usb-detection.win32
fi
