# Encryption utility

## Prerequisites/installation

  * Make sure that the `openssl` utility is installed on the system.
  * Install the application: `cd` to the directory `sys/encrypt`, and execute the command `npm install`.

## Process

1. Prepare 3 directories (`input`, `working` and `shared`), as follows:
  * Go to the root of the `secure-usb-content` project (that is, the parent directory of the `sys` directory)
  * Create the 3 directories: `mkdir input; mkdir working; mkdir shared`
  * Extract the original, unencrypted content files into the `input` directory; make sure that the `input` directory contains an `index.html` file which loads the content (for instance with a `video` tag); see example below under "Notes".
2. Run the encryption UI:
```
$(npm bin)/electron ./encrypt/src/encrypt-main.js
```
The UI shows a form where you should enter the directory paths of the `input`, `working` and `shared` directories.

When the encryption is done (this may take a few minutes), the `shared` directory should contain a `content.asar` file, and a bunch of other files, e.g. `usbcopypro.json`.

You should now be able to successfully run the secure-usb-content app, for instance as follows:
```
cd sys
npm start
```

## Notes

The `input` directory mentioned under "Process" will normally contain at least 2 files (but often more than 2), namely:
* An `index.html` file (the name should be exactly that) which loads the media/content
* One or more media files, for instance a video file (mov, mp3 etcetera)

Here is an example of an `index.html` file. Note that this is NOT the same as the index.html in the app (sys/src/index.html) !

```
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Secure USB</title>
    <style>
        body {
          background-color: #000000;
        }
        video {
          width: 70%    !important;
          height: auto   !important;
          margin: 0 auto;
          display:block;
          padding-bottom: 20px;
        }
        div {
          width: 100%;
          text-align: center;
          font-family:'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif;
          font-size: 2rem;
          color: #e1e1e1;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #333333;
        }
    </style>
  </head>
  <body>
    <div>
      <video controls preload="auto" controlsList="nodownload">
        <source src="somevideo.mp4" type="video/mp4">
      </video>
    </div>
  </body>
</html>
```

In this example, the `input` directory would contain a file "somevideo.mp4" which gets loaded by the index.html page.

## Packaging of the encryption utility (optional)
1. Package with electron forge:
```
npm run package
```
