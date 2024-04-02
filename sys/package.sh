#!/bin/bash
#
# This will package the app in the 'dist' directory.
# run this, then copy.sh
#

export PYTHON='C:\Python312\python.exe'

SYSNAME=`node -e "c=require('./package.json'); console.log(c.name)"`
#export NODE_ENV=production

cd `dirname $0` || exit
_pwd=`pwd`

if [ -d dist ] ; then
    echo "ERROR: dist dir exists" >&2
    exit 1
fi

mkdir dist

# note this requires uglify-es@3
obf=`which uglifyjs`

if [ -z "$obf" ] ; then
    echo 'ERROR: uglifyjs required' >&2
    exit 1
fi

set -e

set -x
: 'Copying source to working directory...'
cp ../repo/file-browser/file-browser*.tgz ./repo/file-browser
cp ../repo/node-usb-detection/usb-detection*.tgz ./repo/node-usb-detection
cp -r src doc package.json package-lock.json default_app locator.json \
      shim-server.js repo forge.config.js dist/
: 'Done!'

cd dist
for npmtgz in `pwd`/repo/*/*.tgz ; do npm cache add $npmtgz ; done
npm install
cp -v package-lock.json ..

(
    echo '// copied by packager, do not edit'
    cat ../encrypt/src/password.js
) > src/password.js

if [ -n "$obf" ] ; then
    find ./src -name \*.js -exec sh -c '
        n=f_.tmp
        "'"$obf"'" --compress --output $n -- "'{}'"
        mv $n "'{}'"
    ' \;
fi

[ ! -d out ] && mkdir out

pushd default_app
asar pack . ../default_app.asar
popd

ARCH=""
if [ "`uname -s`" = "CYGWIN_NT-10.0" ] ; then
    ARCH="--arch=ia32"
fi
npx electron-forge package $ARCH

if [ -d "./out/${SYSNAME}-linux-x64" ] ; then
    dir="${SYSNAME}-linux-x64"
    suffix=linux
elif [ -d "./out/${SYSNAME}-darwin-x64" ] ; then
    dir="${SYSNAME}-darwin-x64/${SYSNAME}.app/Contents"
    suffix=darwin
elif [ -d "./out/${SYSNAME}-win32-ia32" ] ; then
    dir="${SYSNAME}-win32-ia32"
    suffix=win32
elif [ -d "./out/${SYSNAME}-win32-x64" ] ; then
    dir="${SYSNAME}-win32-x64"
    suffix=win32
else
    echo "ERROR: no output dir present"
    exit -1
fi

mv "./out/$dir/resources/app/node_modules/usb-detection" "./out/$dir/resources/app/node_modules/usb-detection.$suffix"

cd "./out/$dir/resources/app/node_modules"
tar xf $_pwd/../repo/contrib/usb-detection.tar.xz

cd "$_pwd/dist/out/$dir"

# no readmes
find . -iname \*.md -delete

if [ $suffix = darwin ] ; then
    pushd ../..
    npx electron-osx-sign "${SYSNAME}.app" --identity='Developer ID Application: Medical Media Ventures, INC (8NPTH57255)' --no-gatekeeper-assess
    popd
else
    mv resources ..
    mkdir resources
    mv ../resources/app/default_app.asar ./resources
    cd ../resources
    mv ./app/locator.json .
    asar p app app.asar
    rm -r app
fi
