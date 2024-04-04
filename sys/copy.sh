#!/bin/bash

#
# run package.sh first
#

set -e

SYSNAME=`node -e "c=require('./package.json'); console.log(c.name)"`

cd `dirname $0`/..

rm -rf app/* drive/*

[ ! -d app ] && mkdir app

DARWIN=0

if [ `uname -s` = "Linux" ] ; then
    drive="${SYSNAME}-linux-x64"
    app="resources/app.asar"
elif [ `uname -s` = "CYGWIN_NT-6.1" ] ; then
    drive="${SYSNAME}-win32-ia32"
    app="resources/app.asar"
elif [ `uname -s` = "CYGWIN_NT-10.0-19045" ] ; then
    drive="${SYSNAME}-win32-x64"
    app="resources/app.asar"
elif [ `uname -s` = "Darwin" ] ; then
    drive="${SYSNAME}-darwin-x64"
    DARWIN=1
else
    echo ERROR: unknown system `uname -s`
    exit 1
fi

mkdir app/sys

pushd sys/dist/out

#
# OSX App
#
if [ $DARWIN = 1 ] ; then
    cd "$drive"
    tar cf - "${SYSNAME}.app" | ( cd ../../../../app/sys ; tar xf - )
    popd
    rm "./app/sys/${SYSNAME}.app/Contents/Resources/app/locator.json"
    echo '{ "shared": "./shared", "app": ".", "drive": "./drive" }' > ./app/sys/locator.json
    exit
fi

#
# Windows App
#
tar cf - "$app" | ( cd ../../../app/sys ; tar xf - )

[ ! -d ../../../drive ] && mkdir ../../../drive
cp -v resources/locator.json ../../../drive/

[ ! -d ../../../app/doc ] && mkdir ../../../app/doc
cp -v ../doc/*.pdf ../../../app/doc

if [ -n "$drive" ] ; then
    mkdir ../../../drive/sys
    cp -r "$drive" ../../../drive/sys/
fi

popd

if [ -x launcher/Release/launcher.exe ] ; then
    cp launcher/Release/launcher.exe drive/Windows_Users_Start.exe
fi

if [ -x ./sys/drive/go-chromecast.exe ] ; then
    cp -v sys/drive/go-chromecast.exe "drive/sys/$drive/"
else
    echo '***********'
    echo Warning: chromecast binary not found
    echo '***********'
fi

cp -v "launcher/Start For Windows.lnk" drive/

git describe --long > drive/gittag-drive.txt
git describe --long > app/gittag-sys.txt

