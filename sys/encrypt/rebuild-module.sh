#!/bin/sh

set -x

../.bin/node-gyp rebuild --target=2.0.7 --arch=ia32 --dist-url=https://atom.io/download/electron

