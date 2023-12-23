const {app, dialog, Menu} = require('electron')

const fs = require('fs');
const Module = require('module');
const path = require('path');

// search up the directory tree until we find the locator config
const locatorFile = 'locator.json';
function findLocator() {
    let found = false;
    let dir = __dirname;
    do {
        if (fs.existsSync(path.join(dir, locatorFile))) {
            found = true;
            break;
        }
        let dirname = path.dirname(dir);
        if (dirname == dir) {
            // we hit bottom!
            break;
        }

        dir = path.resolve(dir,'..');
    } while(!found);

    if (!found) {
        throw new Error("can't find locator file: " + locatorFile);
    }

    console.log('Found locator at ' + dir);
    return dir;
}

// load root file
var locatorPath = findLocator();
var locator = require(path.join(locatorPath, locatorFile));
const file = path.resolve(locatorPath, locator.app);

function loadApplicationPackage (packagePath) {
  try {
    // Override app name and version and menu.
    Menu.setApplicationMenu(null);
    packagePath = path.resolve(packagePath)
    const packageJsonPath = path.join(packagePath, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      let packageJson
      try {
        packageJson = require(packageJsonPath)
      } catch (e) {
        showErrorMessage(`Unable to parse ${packageJsonPath}\n\n${e.message}`)
        return
      }

      if (packageJson.version) {
        app.setVersion(packageJson.version)
      }
      if (packageJson.productName) {
        app.setName(packageJson.productName)
      } else if (packageJson.name) {
        app.setName(packageJson.name)
      }
      app.setPath('userData', path.join(app.getPath('appData'), app.getName()))
      app.setPath('userCache', path.join(app.getPath('cache'), app.getName()))
      app.setAppPath(packagePath)
    }

    // Run the app.
    console.log('Running app at ' + packagePath);
    require(path.join(packagePath, 'src', 'index.js'));
  } catch (e) {
    console.error('App threw an error during load')
    console.error(e.stack || e)
    throw e
  }
}

function showErrorMessage (message) {
  app.focus()
  dialog.showErrorBox('Error launching app', message)
  process.exit(1)
}

loadApplicationPackage(file)
