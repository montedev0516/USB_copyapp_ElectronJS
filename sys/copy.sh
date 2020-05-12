#!/bin/bash

#
# run package.sh first
#

SYSNAME=`node -e "c=require('./package.json'); console.log(c.name)"`

cd `dirname $0`/..

rm -rf app/* drive/*

[ ! -d app ] && mkdir app

if [ `uname -s` = "Linux" ] ; then
    drive="${SYSNAME}-linux-x64"
    app="resources/app.asar"
elif [ `uname -s` = "CYGWIN_NT-6.1" ] ; then
    drive="${SYSNAME}-win32-ia32"
    app="resources/app.asar"
elif [ `uname -s` = "Darwin" ] ; then
    drive="${SYSNAME}-darwin-x64"
    app="resources/app.asar"
else
    echo ERROR: unknown system `uname -s`
    exit 1
fi

mkdir app/sys

pushd sys/dist/out
tar cf - $app | pv | ( cd ../../../app/sys ; tar xf - )

[ ! -d ../../../drive ] && mkdir ../../../drive
cp -v resources/locator.json ../../../drive/

if [ -n "$drive" ] ; then
    mkdir ../../../drive/sys
    cp -r $drive ../../../drive/sys/
    # remove duplicates from OSX build
    rm -rf '../../../drive/sys/usbcopypro-darwin-x64/usbcopypro.app/Contents/Frameworks/Electron Framework.framework/Versions'
    rm -rf '../../../drive/sys/usbcopypro-darwin-x64/usbcopypro.app/Contents/Frameworks/Mantle.framework/Versions'
    rm -rf '../../../drive/sys/usbcopypro-darwin-x64/usbcopypro.app/Contents/Frameworks/ReactiveCocoa.framework/Versions'
    rm -rf '../../../drive/sys/usbcopypro-darwin-x64/usbcopypro.app/Contents/Frameworks/Squirrel.framework/Versions'
fi

popd

if [ -x launcher/Release/launcher.exe ] ; then
    cp launcher/Release/launcher.exe drive/Windows_Users_Start.exe
fi
