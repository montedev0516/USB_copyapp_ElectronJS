#!/bin/bash

#
# run package.sh first
#

cd `dirname $0`/..

[ ! -d shared ] && mkdir shared
[ ! -d app ] && mkdir app
[ ! -d drive ] && mkdir drive

app="resources/app/es6-shim.js resources/app/node_modules resources/app/package.json resources/app/package-lock.json resources/app/src resources/app/.cache"
shared="resources/app/bytes.dat resources/app/cert resources/app/content.asar resources/app/.hidfil.sys"
drive="usbcopypro-linux-x64"

mkdir app/sys
mkdir shared/sys
mkdir drive/sys

pushd sys/out
tar cf - $app | pv | ( cd ../../app/sys ; tar xf - )
tar cf - $shared | pv | ( cd ../../shared/sys ; tar xf - )

mkdir -p drive/sys
cp -r $drive ../../drive/sys/

# OSX is manual
# win32 is manual
