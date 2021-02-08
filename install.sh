#!/bin/bash
# run build_everything.sh first

cd `dirname $0`

SYS=`uname -s`

if [ "$SYS" = "Linux" ] ; then
    INSTALLDIR=/usr/share/usbcopypro
elif [ "$SYS" = "CYGWIN_NT-6.1" ] ; then
    INSTALLDIR=/cygdrive/c/Program\ Files/usbcopypro
elif [ "$SYS" = "CYGWIN_NT-10.0" ] ; then
    INSTALLDIR=/cygdrive/c/Program\ Files\ \(x86\)/usbcopypro
else
    echo "ERROR: unsupported system" >&2
    exit 1
fi

if [ "$1" = "-f" ] ; then
    echo Removing existing installation at $INSTALLDIR
    echo -n 'Continue (y/N)? '
    read cont
    if [ "$cont" != "y" ] ; then
        exit 0
    fi
    rm -fv *.zip || exit 1
    set -x
    sudo rm -r "$INSTALLDIR/"* || exit 1
    set +x
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
sudo unzip $ZIPSDIR/${tag}-app.zip
sudo mkdir drive ; cd drive
sudo unzip $ZIPSDIR/${tag}-drive.zip
cd ../..
sudo mkdir encryption ; cd encryption
ENC=$ZIPSDIR/${tag}-encrypt.zip
if [ -e $ENC ] ; then
    sudo unzip $ENC
fi

echo Installed to $INSTALLDIR
