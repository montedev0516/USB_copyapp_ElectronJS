#!/bin/sh

set -e
set -x

# extract OSX build if any
pushd repo/
rm -rf osx || exit -1
mkdir osx && cd osx
unzip -q ../v*-drive-osx.zip
popd


if [ -z "$1" ] ; then
    # build encryption tool
    cd sys/encrypt
    ./package.sh

    # build 32-bit system
    cd ..
    ./package.sh
else
    cd sys/
fi
./copy.sh
cd ..

# build zip files
./makezip.sh

# finally, run ./install.sh or build the NSIS installer
/cygdrive/c/Program\ Files\ \(x86\)/NSIS/makensis nsis\\ucp.nsi 2>&1 | tee nsis.log
mv -v nsis/usbcopypro.exe usbcopypro-`git describe --tag`.exe
