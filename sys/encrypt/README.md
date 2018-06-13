# Encryption utility

## Prerequisites

  * The root of the system must already be installed with `npm i`.
  * Extract the original, unencrypted content files into a directory
    named `content.orig`.
  * the `openssl` utility must be installed on the system

## Process

1. Run the encryption UI:
```
$(npm bin)/electron ./encrypt/encrypt-main.js
```

## Packaging
1. Package with electron forge:
```
npm run package
```
