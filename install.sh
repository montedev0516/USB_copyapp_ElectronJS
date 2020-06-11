#!/bin/bash

cd `dirname $0`

if [ "$1" = "-f" ] ; then
    echo Removing existing installation...
    rm -fv *.zip || exit 1
    rm -r /usr/share/usbcopypro/* || exit 1
fi

./makezip.sh || exit 1

SYS=`uname -s`
ZIPS=$(eval echo `pwd`/*.zip)

croak() {
    echo "ERROR: $1"
    exit 1
}

if [ "$SYS" = "Linux" ] ; then
    INSTALLDIR=/usr/share/usbcopypro
    mkdir -p $INSTALLDIR/app || croak "no install dir"
    cd $INSTALLDIR/app
    for f in $ZIPS ; do 
        unzip $f
    done
    mv -v locator.json ..
fi
