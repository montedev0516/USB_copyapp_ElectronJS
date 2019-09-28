# Generic Build Instructions

These are the steps to build a fresh, new version of the `Secure USB Content` application.  Note that removing the `package-lock.json` file is only required on the first build.  It can be reused after that.

## Prerequisites

* node.js v8, including npm (this is usually included with node.js, but may require a separate installation on OSX).

Versions as reported by `npm version`:
```
 { npm: '6.9.0',
  ares: '1.14.0',
  cldr: '32.0.1',
  http_parser: '2.7.1',
  icu: '60.2',
  modules: '57',
  nghttp2: '1.30.0',
  node: '8.10.0',
  openssl: '1.0.2n',
  tz: '2017c',
  unicode: '10.0',
  uv: '1.18.0',
  v8: '6.2.414.50',
  zlib: '1.2.11' }
```

## Build Preparation

1. clone the repo
```bash
git clone git@github.com:chromahoen/secure-usb-content.git
cd secure-usb-content
```
2. Clone the submodules
```bash
git submodule init && git submodule update
```
3. Build the submodule: file-browser
```bash
( cd repo/file-browser && \
  rm -f package-lock.json && \
  npm install && \
  npm pack )
```
3. Build the submodule: node-usb-detection
```bash
( cd repo/node-usb-detection && \
  rm -f package-lock.json && \
  npm install && \
  npm pack )
```
4. Install uglifyjs
```bash
npm install -g uglify-es@3
```
5. Install asar
```bash
npm install -g asar
```

## Build

1. Start by changing into the main directory for the project
```bash
cd sys
```
2. OPTIONAL: for a clean build, remove the lock file and re-download everything.  This should not be done with every build
```bash
rm -f package-lock.json && \
  rm -rf node_modules
```
3. Install required node modules
```bash
npm install
```

Link the platform-dependent modules:
```bash
./link.sh
```

NOTE: at this point, you can start the development version of the system by
using `npm start`.  Note that paths in `locator.json` need to be set correctly
in order for the system to execute.
4. OPTIONAL: edit the `package.json` file to use the required application name for the client.  This is really only required if you want the OSX title bar to be something other than `usbcopypro`.  Update this line if required:
```bash
  "name": "usbcopypro",
```
5. Build the application.  This will build the default app, run `electron-forge` and a few other things.
The resulting system will be in the `dist/` dir.
```bash
./package.sh
```
6. Copy the data for final packaging
```bash
./copy.sh
```
7. Make zip files for distribution
```bash
cd ..
./makezip.sh
```

The result will be 3 zipfiles tagged based on the version reported
by `git describe`:
* `<version>-app.zip` : platform independent electron app
* `<version>-drive.zip` : platform SPECIFIC binaries
* `<version>-encrypt.zip` : platform SPECIFIC encryption tool

## Encryption Tool

This assumes the encryption tool has already been built for the
target platform.  For encryption instructions,
see [encryption](./encrypt/README.md).

