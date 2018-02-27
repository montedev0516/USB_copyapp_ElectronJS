const {app, dialog} = require('electron')

const fs = require('fs')
const Module = require('module')
const path = require('path')

// Parse command line options.
const argv = process.argv.slice(1)
const file = argv[0];

function loadApplicationPackage (packagePath) {
  // Add a flag indicating app is started from default app.
  process.defaultApp = true

  try {
    // Override app name and version.
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

    try {
      Module._resolveFilename(packagePath, module, true)
    } catch (e) {
      showErrorMessage(`Unable to find Electron app at ${packagePath}\n\n${e.message}`)
      return
    }

    // Run the app.
    Module._load(packagePath, module, true)
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
