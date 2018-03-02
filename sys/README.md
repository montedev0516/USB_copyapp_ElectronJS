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

Note: this assumes encrypted content already exists in the `content/` dir.  For
encryption instructions, see [encryption](./encrypt/README.md).

In the `sys` directory, run
```
./package.sh
```
This will build the default app, run `electron-forge` and a few other things.
The resulting system will be in the `out/` dir and should have a directory
structure similar to:
```
out/
├── resources
│   └── app
│       ├── cert
│       ├── content <-- encrypted content
│       └── src     <-- platform-independent system
└── usbcopypro-linux-x64
    ├── locales
    └── resources
```
NOTE: `content.tar.xz` is provided for convenience and contains the
encrypted files.  It is not included in the final system.
