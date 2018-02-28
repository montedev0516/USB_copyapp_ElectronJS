#!/bin/sh

[ ! -d out ] && mkdir out

set -x

tar cfJ out/content.tar.xz content/ bytes.dat .hidfil.sys

( cd default_app ; asar pack . ../default_app.asar )

electron-forge package || exit
if [ -d ./out/everyusb-linux-x64 ] ; then
    dir=everyusb-linux-x64
    suffix=linux
elif [ -d ./out/everyusb-darwin-x64 ] ; then
    dir=everyusb-darwin-x64/everyusb.app/Contents
    suffix=darwin
elif [ -d ./out/everyusb-win32-ia32 ] ; then
    dir=everyusb-win32-ia32
    suffix=win32
else
    echo "ERROR: no output dir present"
    exit -1
fi

mv ./out/$dir/resources/app/node_modules/usb-detection ./out/$dir/resources/app/node_modules/usb-detection.$suffix

cd ./out/$dir || exit
if [ $suffix == darwin ] ; then
    mv resources ../..
    mkdir resources
    mv ../../resources/electron.asar ../../resources/*.lproj ../../resources/*.icns ./resources
    mv ../../resources/app/default_app.asar ./resources
else
    mv resources ..
    mkdir resources
    mv ../resources/electron.asar ./resources
    mv ../resources/app/default_app.asar ./resources
fi

