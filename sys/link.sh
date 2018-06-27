#!/bin/sh

OS=`/bin/uname -s`

if [ $OS = "Linux" ] ; then
    link=node_modules/usb-detection.linux
elif [ $OS = "Darwin" ] ; then
    link=node_modules/usb-detection.darwin
else
#    export CYGWIN=winsymlinks:nativestrict
#    link=node_modules/usb-detection.win32
    cp -r node_modules/usb-detection node_modules/usb-detection.win32
    exit
fi

if [ ! -L $link ] ; then 
    /bin/ln -vs usb-detection $link
fi
