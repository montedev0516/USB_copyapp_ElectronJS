#!/bin/sh

[ ! -d out ] && mkdir out

set -x

tar cfJ out/content.tar.xz content/ bytes.dat .hidfil.sys

( cd default_app ; asar pack . ../default_app.asar )

electron-forge package || exit
if [ -d ./out/everyusb-linux-x64 ] ; then
    dir=everyusb-linux-x64
    suffix=linux
else
    dir=everyusb-win32-ia32
    suffix=win32
fi

mv ./out/$dir/resources/app/node_modules/usb-detection ./out/$dir/resources/app/node_modules/usb-detection.$suffix

cd ./out/$dir
mv resources ..
mkdir resources
mv ../resources/electron.asar ./resources
mv ../resources/app/default_app.asar ./resources
