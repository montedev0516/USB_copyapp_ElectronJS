const electron = require('electron');
const app = electron.app;

const path = require('path');
const url = require('url');

console.log('EveryUSB Constent System starting');

let mainWindow;

function createWindow() {
    mainWindow = new electron.BrowserWindow();

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'evusb.html'),
        protocol: 'file:',
        slashes: true
    }));

    //mainWindow.webContents.openDevTools()

    mainWindow.on('closed', function() {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

// start the server
require('./server.js');
