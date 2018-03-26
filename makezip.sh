#!/bin/bash

#
# shared: shared content files
# app: platform-independent (mostly) app files
# drive: platform-specific binaries for electron
#
DIRS="shared app drive"

tag=`git describe --tag`

for d in $DIRS ; do
    [ -d $d ] || continue
    FILE=${tag}-${d}.zip
    echo Writing $FILE
    pushd $d > /dev/null 2>&1 || exit
    zip -r ../$FILE . | pv > /dev/null
    popd > /dev/null 2>&1
done
