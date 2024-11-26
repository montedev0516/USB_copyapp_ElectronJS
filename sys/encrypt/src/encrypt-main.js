const electron = require('electron');
const url = require('url');
const path = require('path');

// this uses electron remote for dialogs
require('@electron/remote/main').initialize();

const { Menu, MenuItem } = electron;

const { app } = electron;


let mainWindow;

function onAbout() {
    mainWindow.webContents.send('showabout');
}

function createWindow() {
    mainWindow = new electron.BrowserWindow({
        width: 800,
        height: 700,
        icon: path.join(__dirname, './img/appicon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'encrypt-main.html'),
        protocol: 'file:',
        slashes: true,
    }));
    // mainWindow.webContents.openDevTools();

    // needed to display remote dialog windows
    require('@electron/remote/main').enable(mainWindow.webContents);

    mainWindow.on('closed', () => {
        mainWindow = null;
        process.exit(0);
    });

    // main application menu
    const menu = new Menu();
    const about = new Menu();

    about.append(new MenuItem({
        label: 'About',
        click: onAbout,
    }));

    menu.append(new MenuItem({
        label: 'Help',
        submenu: about,
    }));

    Menu.setApplicationMenu(menu);
}

// diskusage native proc requires no process reuse
app.allowRendererProcessReuse = false;
app.on('ready', createWindow);
