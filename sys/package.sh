#!/bin/sh

[ ! -d out ] && mkdir out

set -x

tar cfJ out/content.tar.xz content/ bytes.dat .hidfil.sys

rm -f node_modules/file-browser node_modules/usb-detection*
rm -f package-lock.json

( cd default_app ; asar pack . ../default_app.asar )

electron-forge package
if [ -d ./out/everyusb-linux-x64 ] ; then
    dir=everyusb-linux-x64
    suffix=linux
else
    dir=everyusb-win32-ia32
    suffix=win32
fi

cp -r ../repo/file-browser ./out/$dir/resources/app/node_modules/
cp -r ../repo/node-usb-detection ./out/$dir/resources/app/node_modules/usb-detection.$suffix

cd ./out/$dir
mv resources ..
mkdir resources
mv ../resources/electron.asar ./resources
mv ../resources/app/default_app.asar ./resources
