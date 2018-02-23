#!/bin/sh

OS=`uname -s`

if [ $OS = "Linux" ] ; then
    link=node_modules/usb-detection.linux
elif [ $OS = "Darwin" ] ; then
    link=node_modules/usb-detection.darwin
else
    link=node_modules/usb-detection.win32
fi

if [ ! -L $link ] ; then 
    ln -vs usb-detection $link
fi
