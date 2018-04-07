#!/bin/bash

#
# shared: shared content files
# app: platform-independent (mostly) app files
# drive: platform-specific binaries for electron
#
DIRS="shared app drive"

tag=`git describe --tag`

cat > drive/locator.json <<EOT
{
    "shared": "./shared",
    "app": "./app/sys/resources/app",
    "drive": "./drive"
}
EOT

for d in $DIRS ; do
    [ -d $d ] || continue
    FILE=${tag}-${d}.zip
    echo Writing $FILE
    pushd $d > /dev/null 2>&1 || exit
    zip -r ../$FILE . | pv > /dev/null
    popd > /dev/null 2>&1
done
