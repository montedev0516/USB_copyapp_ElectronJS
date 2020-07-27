#!/bin/bash

cd `dirname $0`

SYS=`uname -s`

if [ "$SYS" = "Linux" ] ; then
    INSTALLDIR=/usr/share/usbcopypro
elif [ "$SYS" = "CYGWIN_NT-6.1" ] ; then
    INSTALLDIR=/cygdrive/c/Program\ Files/usbcopypro
else
    echo "ERROR: unsupported system" >&2
    exit 1
fi

if [ "$1" = "-f" ] ; then
    echo Removing existing installation...
    rm -fv *.zip || exit 1
    rm -r "$INSTALLDIR/"* || exit 1
fi

./makezip.sh || exit 1

croak() {
    echo "ERROR: $1"
    exit 1
}

tag=`git describe --tag`

mkdir -p "$INSTALLDIR/app" || croak "no install dir"
ZIPSDIR="`pwd`"
cd "$INSTALLDIR/app"
unzip $ZIPSDIR/${tag}-app.zip
unzip $ZIPSDIR/${tag}-drive.zip
cd ..
ENC=$ZIPSDIR/${tag}-encrypt.zip
if [ -e $ENC ] ; then
    unzip $ENC
fi
mv -v app/locator.json .

echo Installed to $INSTALLDIR