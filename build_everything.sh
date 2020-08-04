#!/bin/sh

set -e
set -x

# build encryption tool
cd sys/encrypt
./package.sh

# build 32-bit system
cd ..
./package.sh
./copy.sh

# build zip files
cd ..
./makezip.sh

# finally, run ./install.sh or build the NSIS installer
/cygdrive/c/Program\ Files\ \(x86\)/NSIS/makensis nsis\\ucp.nsi
mv -v nsis/usbcopypro.exe usbcopypro-`git describe --tag`.exe
