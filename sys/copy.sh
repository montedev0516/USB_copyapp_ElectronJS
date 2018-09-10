#!/bin/bash

#
# run package.sh first
#

cd `dirname $0`/..

rm -rf app/* drive/*

[ ! -d app ] && mkdir app

app="resources/app.asar"
if [ `uname -s` = "Linux" ] ; then
    drive="usbcopypro-linux-x64"
elif [ `uname -s` = "CYGWIN_NT-6.1" ] ; then
    drive="usbcopypro-win32-ia32"
fi

mkdir app/sys

pushd sys/dist/out
tar cf - $app | pv | ( cd ../../../app/sys ; tar xf - )

[ ! -d ../../../drive ] && mkdir ../../../drive
cp -v resources/locator.json ../../../drive/

if [ -n "$drive" ] ; then
    mkdir ../../../drive/sys
    cp -r $drive ../../../drive/sys/

    # OSX is manual
fi

popd

if [ -x launcher/Release/launcher.exe ] ; then
    cp launcher/Release/launcher.exe drive/Windows_Users_Start.exe
fi
