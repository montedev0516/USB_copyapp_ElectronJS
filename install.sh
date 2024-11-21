#!/bin/bash
# run first:
#   build_everything.sh
# OR
#   makezip.sh (makes zipfiles only, no rebuild)

cd `dirname $0`

SYS=`uname -s`

if [ "$SYS" = "Linux" ] ; then
    INSTALLDIR=/usr/share/usbcopypro
elif [ "$SYS" = "CYGWIN_NT-6.1" ] ; then
    INSTALLDIR=/cygdrive/c/Program\ Files/usbcopypro
elif [ "$SYS" = "CYGWIN_NT-10.0" ] ; then
    INSTALLDIR=/c/Program\ Files\ \(x86\)/usbcopypro
else
    echo "ERROR: unsupported system" >&2
        INSTALLDIR=/c/Program\ Files\ \(x86\)/usbcopypro

fi

if [ "$1" = "-f" ] ; then
    shift
    echo Removing existing installation at $INSTALLDIR
    echo -n 'Continue (y/N)? '
    read cont
    if [ "$cont" != "y" ] ; then
        exit 0
    fi
    set -x
    sudo rm -r "$INSTALLDIR/"* || exit 1
    set +x
fi

croak() {
    echo "ERROR: $1"
    exit 1
}

if [ -z "$1" ] ; then
    tag=`git describe --tag`
else
    tag=$1
fi

echo Installing version $tag

mkdir -p "$INSTALLDIR/app" || croak "no install dir"
ZIPSDIR="`pwd`"
cd "$INSTALLDIR/app"
unzip $ZIPSDIR/${tag}-app.zip || croak "can't install app"

mkdir drive ; cd drive
unzip $ZIPSDIR/${tag}-drive.zip || croak "can't install drive"

OSXAPP=$ZIPSDIR/repo/osx/sys/usbcopypro-darwin-x64/usbcopypro.app
if [ -d $OSXAPP ] ; then
    cp -rv $OSXAPP . || exit -1
fi
WINAPP=$ZIPSDIR/repo/win32/sys/usbcopypro-win32-ia32
if [ -d $WINAPP ] ; then
    cp -rv $WINAPP ./sys/ || exit -1
fi

cd ../..
mkdir encryption ; cd encryption
ENC=$ZIPSDIR/${tag}-encrypt.zip
if [ -e $ENC ] ; then
    unzip $ENC || croak "can't install enctool"
fi

echo Installed to $INSTALLDIR
