/**
 * Module in charge of the Tray
 */

const os = require('os');
const path = require('path');
const { Tray, Menu, app, ipcMain, nativeImage } = require('electron');

const ModuleWindow = require('./module-window');


class TrayModule extends ModuleWindow {
  constructor(window) {
    super(window);

    // Darwin used to be supported, it is now disabled because its usage do not
    // make a lot of sense on this platform, as the icon always stay in the dock
    //
    // 01/04/2018 actually not for now, I do not want to break a feature in a
    // patch release
    // this.platforms = ['win32', 'linux'];
  }

  load() {
    const appRoot = path.resolve(__dirname, '../../..'); // Maybe a better way to know this?
    const logosPath = path.join(appRoot, 'src', 'images', 'logos');
    const trayIcons = {
      'tray': nativeImage.createFromPath(path.join(logosPath, 'museeks-tray.png')).resize({ width: 24, height: 24 }),
      'tray-win32': nativeImage.createFromPath(path.join(logosPath, 'museeks-tray.ico')),
      'tray-darwin-dark': nativeImage.createFromPath(path.join(logosPath, 'museeks-tray-dark.png')),
    };

    // Make it "lightable" on macOS
    trayIcons['tray-darwin-dark'].setTemplateImage(true);

    this.tray = null;

    // Pick the right icon for the right platform
    this.trayIcon = trayIcons['tray'];
    if (os.platform() === 'win32') this.trayIcon = trayIcons['tray-win32'];
    else if (os.platform() === 'darwin') this.trayIcon = trayIcons['tray-darwin-dark'];

    this.contextMenu;

    this.songDetails = [
      {
        label: 'Not playing',
        enabled: false,
      },
      {
        type: 'separator',
      },
    ];

    this.playToggle = [
      {
        label: 'Play',
        click: () => {
          this.window.webContents.send('playback:play');
        },
      },
    ];

    this.pauseToggle = [
      {
        label: 'Pause',
        click: () => {
          this.window.webContents.send('playback:pause');
        },
      },
    ];

    this.menu = [
      {
        label: 'Previous',
        click: () => {
          this.window.webContents.send('playback:previous');
        },
      },
      {
        label: 'Next',
        click: () => {
          this.window.webContents.send('playback:next');
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Show',
        click: () => {
          this.window.show();
          this.window.focus();
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Quit',
        click: () => {
          app.quit();
          this.window.destroy();
        },
      },
    ];

    // Load events listener for player actions
    ipcMain.on('playback:play', () => {
      this.setContextMenu('play');
    });

    ipcMain.on('playback:pause', () => {
      this.setContextMenu('pause');
    });

    ipcMain.on('playback:trackChange', (event, track) => {
      this.updateTrayMetadata(track);
      this.setContextMenu('play');
    });

    this.show();
  }

  show() {
    this.tray = new Tray(this.trayIcon);
    if(this.trayIconHovered) this.tray.setPressedImage(this.trayIconHovered);

    this.tray.setToolTip('Museeks');

    if(os.platform() === 'win32') {
      this.tray.on('click', () => {
        this.window.show();
        this.window.focus();
      });
    } else if(os.platform() === 'darwin') {
      this.tray.on('double-click', () => {
        this.window.show();
        this.window.focus();
      });
    }

    this.setContextMenu('pause');
  }

  setContextMenu(state) {
    const playPauseItem = state === 'play' ? this.pauseToggle : this.playToggle;
    const menuTemplate = [...this.songDetails, ...playPauseItem, ...this.menu];
    this.tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
  }


  updateTrayMetadata(track) {
    this.songDetails = [
      {
        label: `${track.title}`,
        enabled: false,
      },
      {
        label: `by ${track.artist}`,
        enabled: false,
      },
      {
        label: `on ${track.album}`,
        enabled: false,
      },
      {
        type: 'separator',
      },
    ];
  }
}

module.exports = TrayModule;
