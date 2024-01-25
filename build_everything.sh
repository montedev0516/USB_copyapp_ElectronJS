#!/bin/bash

set -e
set -x

# extract OSX build if any
pushd repo/
rm -rf osx win32 || exit -1
mkdir osx && cd osx
unzip -q ../v*-drive-osx.zip
cd ..

# extract windows build if any
if [ -e ../v*-drive-win32.zip ] ; then
    mkdir win32 && cd win32
    unzip -q ../v*-drive-win32.zip
fi
popd


if [ -z "$1" ] ; then
    # build encryption tool
    cd sys/encrypt
    rm -rf out
    ./package.sh

    # build content system
    cd ..
    rm -rf dist
    ./package.sh
else
    cd sys/
fi
./copy.sh
cd ..

# build zip files
./makezip.sh

# finally, run ./install.sh or build the NSIS installer
if [ -x /cygdrive/c/Program\ Files\ \(x86\)/NSIS/makensis ] ; then
    /cygdrive/c/Program\ Files\ \(x86\)/NSIS/makensis nsis\\ucp.nsi 2>&1 | tee nsis.log
    mv -v nsis/usbcopypro.exe usbcopypro-`git describe --tag`.exe
fi
