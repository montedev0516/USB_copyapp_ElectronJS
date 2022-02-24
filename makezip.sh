#!/bin/bash

#
# encrypt: encryption tool
# app: platform-independent (mostly) app files
# drive: platform-specific binaries for electron
#
DIRS="app drive"

tag=`git describe --tag`

cat > drive/locator.json <<EOT
{
    "shared": "./shared",
    "app": "../sys/resources/app.asar",
    "drive": ".\\\\sys\\\\usbcopypro-win32-ia32"
}
EOT

if [ -d ./sys/encrypt/out ] ; then
    pushd sys/encrypt/out  > /dev/null 2>&1 || exit
    FILE=${tag}-encrypt.zip
    rm -f $FILE
    echo Writing $FILE
    zip -r ../../../$FILE . | pv > /dev/null
    popd > /dev/null 2>&1
fi

for d in $DIRS ; do
    [ -d $d ] || continue
    FILE=${tag}-${d}.zip
    rm -f $FILE
    echo Writing $FILE
    pushd $d > /dev/null 2>&1 || exit
    zip -r ../$FILE . | pv > /dev/null
    popd > /dev/null 2>&1
done
