# Encryption utility

## Prerequisites

  * The root of the system must already be installed with `npm i`.
  * Extract the original, unencrypted content files into a directory
    named `content.orig`.

## Process

NOTE: this is intended to be run from the project root (i.e. `sys/`).
All paths are relative to that directory.

1. Edit the `./src/config.json` file to contain a random salt
value, the vendor ID, and the length of the serial ID to match on.  e.g.:
```
{
    "SERVER_PORT": 29500,
    "LAUNCH_URL": "https://localhost:29500/test.html",
    "salt": "c17155ee526f4f39bad7d262395a26ad",
    "validVendors": ["58f"],
    "serialLength": 5
}
```
For example, a serial length of 5 will match 09119257 and 0911999.
2. Craft the encryption variables into a shell script
named `encrypt-settings.sh`.  This consists of:
  * vid, pid, and the serial, which construct the key.
  * the list of files to encrypt, in a format passed directly to the
    unix `find` utility.
  * example:
```bash
vid="12af"
pid="f83f"
ser="FOO1234567"
FILES='\( -name \*.html -o -name \*.png -o -name \*.svg -o -name \*.jpg -o -name \*.xml \)'
```
3. Run the encryption shell script:
```
./encrypt.sh
```
This will encrypt all files according to the names selected in the `FILES`
variable of `encrypt-settings.sh`.  The resulting files will be in
the `content/` dir, with other encryption settings in `.hidfil.sys`
and `bytes.dat`.

