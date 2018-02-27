#!/bin/sh

OS=`/usr/bin/uname -s`

if [ $OS = "Linux" ] ; then
    link=node_modules/usb-detection.linux
elif [ $OS = "Darwin" ] ; then
    link=node_modules/usb-detection.darwin
else
    export CYGWIN=winsymlinks:nativestrict
    link=node_modules/usb-detection.win32
fi

if [ ! -L $link ] ; then 
    /usr/bin/ln -vs usb-detection $link
fi
