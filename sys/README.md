# Every USB Secure Content System

## Prerequisites
* node.js 8.9.4
* npm 5.6.0
* asar
```
npm install -g asar
```
* uglify-es
```
npm install -g uglify-es
```

## Installation

First, the submodules must be packaged.  This only needs to be done
once.  Download them with:
```bash
git submodule init
git submodule update
```
Then package:
```bash
cd repo/file-browser
npm pack
cd ../node-usb-detection
npm pack
```
Then, change to the `sys` directory and run
```bash
npm install
```
Finally, link the platform-dependent modules:
```bash
./link.sh
```

## Running

In the `sys` directory, run
```bash
npm start
```
This will launch the system using `electron-forge`, including the web
server and the chromium browser window pointed to the launch page.

## Packaging

Note: this assumes the encryption tool has already been built for the
target platform.  For encryption instructions,
see [encryption](./encrypt/README.md).

* 1. In the `sys` directory, run
```
./package.sh
```
This will build the default app, run `electron-forge` and a few other things.
The resulting system will be in the `dist/` dir.
* 2. Next, copy the data for final packaging.
```
./copy.sh
```
* 3. Finally, cd up one dir and make the zip files.
```
cd ..
./makezip.sh
```

The result will be 3 zipfiles tagged based on the version reported
by `git describe`:
* `<version>-app.zip` : platform independent electron app
* `<version>-drive.zip` : platform SPECIFIC binaries
* `<version>-encrypt.zip` : platform SPECIFIC encryption tool
