const electron = require('electron');
const url = require('url');
const path = require('path');
const app = electron.app;

let mainWindow;

function createWindow() {

    mainWindow = new electron.BrowserWindow({
        width: 800,
        height: 600,
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'encrypt-main.html'),
        protocol: 'file:',
        slashes: true
    }));

    mainWindow.on('closed', () => {
        mainWindow = null;
        process.exit(0);
    });
}

app.on('ready', createWindow);
