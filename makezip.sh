#!/bin/bash

#
# encrypt: encryption tool
# shared: shared content files
# app: platform-independent (mostly) app files
# drive: platform-specific binaries for electron
#
DIRS="shared app drive"

tag=`git describe --tag`

cat > drive/locator.json <<EOT
{
    "shared": "./shared",
    "app": "./app/sys/resources/app.asar",
    "drive": ".\\\\drive\\\\sys\\\\usbcopypro-win32-ia32\\\\usbcopypro.exe"
}
EOT

if [ -d ./sys/encrypt/out ] ; then
    pushd sys/encrypt/out  > /dev/null 2>&1 || exit
    FILE=${tag}-encrypt.zip
    echo Writing $FILE
    zip -r ../../../$FILE . | pv > /dev/null
    popd > /dev/null 2>&1
fi

for d in $DIRS ; do
    [ -d $d ] || continue
    FILE=${tag}-${d}.zip
    echo Writing $FILE
    pushd $d > /dev/null 2>&1 || exit
    zip -r ../$FILE . | pv > /dev/null
    popd > /dev/null 2>&1
done
