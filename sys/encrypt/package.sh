#!/bin/bash

set -e

git describe --long > .usbgittag 

npx electron-forge package

OUTDIR=out/usbcopypro-encrypt-win32-x64

unzip ../../repo/openssl-1.0.2n-i386-win32.zip -d $OUTDIR/

chmod a+x $OUTDIR/*.exe $OUTDIR/*.dll
