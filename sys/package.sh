#!/bin/bash
#
# This will package the app in the 'dist' directory.
# run this, then copy.sh
#

set -e

SYSNAME=`node -e "c=require('./package.json'); console.log(c.name)"`

cd `dirname $0` || exit
_pwd=`pwd`

if [ -d dist ] ; then
    echo "ERROR: dist dir exists" >&2
    exit 1
fi

mkdir dist

set -x
: 'Copying source to working directory...'
cp -r src package* default_app locator.json es6-shim-server.js dist/
: 'Done!'

cd dist
npm install
cp -v package-lock.json ..

# Hackish build for native module.  This
# should not be here.
if uname | grep -iq cygwin ; then
    (
        set -e
        cd node_modules/usb-detection
        mv binding.gyp.old binding.gyp
        ../../../rebuild-module.sh
    ) || exit
fi

# note this requires uglify-es@3
obf=`which uglifyjs`

if [ -n "$obf" ] ; then
    find ./src -name \*.js -exec sh -c '
        n=f_.tmp
        '$obf' --compress --output $n -- "'{}'"
        mv $n "'{}'"
    ' \;
fi

[ ! -d out ] && mkdir out

pushd default_app
asar pack . ../default_app.asar
popd

(
    echo '// copied by packager, do not edit'
    cat ../encrypt/src/password.js
) > src/password.js

$(npm bin)/electron-forge package
if [ -d ./out/${SYSNAME}-linux-x64 ] ; then
    dir=${SYSNAME}-linux-x64
    suffix=linux
elif [ -d ./out/${SYSNAME}-darwin-x64 ] ; then
    dir=${SYSNAME}-darwin-x64/${SYSNAME}.app/Contents
    suffix=darwin
elif [ -d ./out/${SYSNAME}-win32-ia32 ] ; then
    dir=${SYSNAME}-win32-ia32
    suffix=win32
else
    echo "ERROR: no output dir present"
    exit -1
fi

mv ./out/$dir/resources/app/node_modules/usb-detection ./out/$dir/resources/app/node_modules/usb-detection.$suffix

cd ./out/$dir/resources/app/node_modules
tar xf $_pwd/../repo/contrib/usb-detection.tar.xz

cd $_pwd/dist/out/$dir

# blank compiled JS files
find ./resources/app/src -type f -exec sh -c 'echo -n > {}' \;

# no readmes
find . -iname \*.md -delete

if [ $suffix = darwin ] ; then
    mv Resources ../../../resources
    mkdir resources
    mv ../../../resources/electron.asar ../../../resources/*.lproj ../../../resources/*.icns ./resources
    mv ../../../resources/app/default_app.asar ./resources
    cd ../../../resources
else
    mv resources ..
    mkdir resources
    mv ../resources/electron.asar ./resources
    mv ../resources/app/default_app.asar ./resources
    cd ../resources
fi
mv ./app/locator.json .
asar p app app.asar
rm -r app
