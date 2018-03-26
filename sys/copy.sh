#!/bin/bash

#
# run package.sh first
#

cd `dirname $0`/..

[ ! -d app ] && mkdir app

app="resources/app/es6-shim.js resources/app/node_modules resources/app/package.json resources/app/package-lock.json resources/app/src resources/app/.cache"
if [ `uname -s` = "Linux" ] ; then
    drive="usbcopypro-linux-x64"
fi

mkdir app/sys

pushd sys/out
tar cf - $app | pv | ( cd ../../app/sys ; tar xf - )

if [ -n "$drive" ] ; then
    mkdir -p drive/sys
    cp -r $drive ../../drive/sys/

    # OSX is manual

    # win32 is manual
fi

