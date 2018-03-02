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

In this `sys` directory, run
```bash
npm install
```

## Running

In this `sys` directory, run
```bash
npm start
```
This will launch the system, including the web server and the chromium browser
window pointed to the launch page.

## Packaging

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
