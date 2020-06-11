#!/bin/bash

cd `dirname $0`

if [ "$1" = "-f" ] ; then
    echo Removing existing installation...
    rm -fv *.zip || exit 1
    rm -r /usr/share/usbcopypro/* || exit 1
fi

./makezip.sh || exit 1

SYS=`uname -s`

croak() {
    echo "ERROR: $1"
    exit 1
}

tag=`git describe --tag`

if [ "$SYS" = "Linux" ] ; then
    INSTALLDIR=/usr/share/usbcopypro
    mkdir -p $INSTALLDIR/app || croak "no install dir"
    ZIPSDIR=`pwd`
    cd $INSTALLDIR/app
    unzip $ZIPSDIR/${tag}-app.zip
    unzip $ZIPSDIR/${tag}-drive.zip
    cd ..
    ENC=$ZIPSDIR/${tag}-encrypt.zip
    if [ -e $ENC ] ; then
        unzip $ENC
    fi
    mv -v app/locator.json .
fi
