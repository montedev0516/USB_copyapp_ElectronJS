#!/bin/bash
#


SYSNAME=`node -e "c=require('./package.json'); console.log(c.name)"`

cd `dirname $0` || exit
_pwd=`pwd`

dir=${SYSNAME}-darwin-x64/${SYSNAME}.app/Contents
suffix=darwin

cd $_pwd/dist/out/$dir

mv Resources ../../../resources
mkdir resources
mv ../../../resources/*.lproj ./resources
mv ../../../resources/app/default_app.asar ./resources
cd ../../../resources

mv ./app/locator.json .
asar p app app.asar
rm -r app
