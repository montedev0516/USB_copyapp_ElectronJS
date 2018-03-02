#!/bin/bash
SYSNAME=usbcopypro

cd `dirname $0` || exit
_pwd=`pwd`

[ ! -d out ] && mkdir out

set -e
set -x

tar cfJ out/content.tar.xz content/ bytes.dat .hidfil.sys

( cd default_app ; asar pack . ../default_app.asar )

find node_modules -maxdepth 1 -type l -delete

$(npm bin)/electron-forge package
if [ -d ./out/${SYSNAME}-linux-x64 ] ; then
    dir=${SYSNAME}-linux-x64
    suffix=linux
elif [ -d ./out/${SYSNAME}-darwin-x64 ] ; then
    dir=${SYSNAME}-darwin-x64/${SYSNAME}.app/Contents
    suffix=darwin
elif [ -d ./out/${SYSNAME}-win32-ia32 ] ; then
    dir=${SYSNAME}-win32-ia32
    suffix=win32
else
    echo "ERROR: no output dir present"
    exit -1
fi

mv ./out/$dir/resources/app/node_modules/usb-detection ./out/$dir/resources/app/node_modules/usb-detection.$suffix

cd ./out/$dir/resources/app/node_modules
tar xf $_pwd/../repo/contrib/usb-detection.tar.xz

cd $_pwd/out/$dir

# no readmes
find . -iname \*.md -delete

if [ $suffix = darwin ] ; then
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

cd $_pwd/out

rm ./resources/app/package*
find ./resources/app -name .npmignore -delete

# note this requires uglify-es@3
obf=`which uglifyjs`

if [ -n "$obf" ] ; then
    find ./resources/app/src -name \*.js -exec sh -c '
        n=f_.tmp
        '$obf' --compress --output $n -- "'{}'"
        mv $n "'{}'"
    ' \;
fi

