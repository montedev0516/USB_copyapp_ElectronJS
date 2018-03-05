#!/bin/bash

#
# shared: shared content files
# app: platform-independent (mostly) app files
# drive: platform-specific binaries for electron
#
DIRS="shared app drive"

for d in $DIRS ; do
    pushd $d || exit
    zip -r ../${d}.zip .
    popd
done
