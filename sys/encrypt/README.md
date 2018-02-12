# Encryption utility

1. Edit the `encrypt/encrypt-config.json` configuration file with values from 
the manufacturer, based on the batch of drives being produced.  e.g.:
```
{
    "vid": "58f",
    "pid": "6387",
    "mfg": "1",
    "prod": "2",
    "serial": "3",
    "descString1": "Generic",
    "descString2": "Mass Storage",
    "descString3": "09119257",
    "apiKey": "XXX"
}
```
The `descString3` field will be truncated based on settings in the next step.
2. Edit the `config.json` file to contain the desired random salt value, the
vendor ID, and the length of the serial ID to match on.  e.g.:
```
{
    "SERVER_PORT": 29500,
    "LAUNCH_URL": "./content/test.html",
    "salt": "c17155ee526f4f39bad7d262395a26ad",
    "validVendors": ["58f"],
    "serialLength": 5
}
```
For example, a serial length of 5 will match 09119257 and 0911999.
3. Run the encryption utility with the list of filenames to lock.  **NOTE:**
This process re-generates the random bytes with each run, so it must be run
once with all filenames to be encrypted.  This should probably change.
```
$ ./encrypt/encrypt.js `find content_ -name \*.png`
encrypting 2 files
serial: 58f:6387:Generic:Mass Storage:09
vers  : 1.2.3
apikey: XXX
content_/xkcd_epoch_fail.png.lock
content_/jabba-philosophy.png.lock
```
4. After encryption, the original files should be removed from the `content/`
directory.  
5. The `encrypt/` directory should not be included in the final image either.
6. Key generated files *to* include in the final image are `bytes.dat`, 
`.hidfil.sys`, and all the generated `*.lock` files.
7. If required, the client's site code needs to be updated to fetch the 
encrypted version of media files, instead of accessing the files themselves.
This is done by replacing these references with URLs like
```
http://localhost:29500/x?f=xkcd_epoch_fail.png.lock&t=image/png
```
The root of the path is the `content/` directory.  The mime-type of the 
resulting file is required in the `t` query paramter.
