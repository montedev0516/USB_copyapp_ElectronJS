#!/bin/bash

cd `dirname $0`

SYS=`uname -s`
ZIPS=$(eval echo `pwd`/*.zip)

croak() {
    echo "ERROR: $1"
    exit 1
}

if [ "$SYS" = "Linux" ] ; then
    INSTALLDIR=/usr/share/usbcopypro
    mkdir -p $INSTALLDIR/sys || croak "no install dir"
    cd $INSTALLDIR/sys
    for f in $ZIPS ; do 
        unzip $f
    done
fi
