import electron from 'electron';
import os from 'os';

import Player from '../lib/player';
import { browserWindows, config }  from '../lib/app';
import * as utils from '../utils/utils';

import * as LibraryActions  from './LibraryActions';
import * as PlaylistsActions from './PlaylistsActions';
import * as NotificationsActions from './NotificationsActions';
import * as PlayerActions from './PlayerActions';
import * as SettingsActions from './SettingsActions';

const ipcRenderer    = electron.ipcRenderer;

const init = () => {
  // Usual tasks
  LibraryActions.load();
  PlaylistsActions.refresh();
  SettingsActions.check();

  // Tell the main process to show the window
  ipcRenderer.send('app:ready');

  // Bind player events
  // Audio Events
  Player.getAudio().addEventListener('ended', PlayerActions.next);
  Player.getAudio().addEventListener('error', PlayerActions.audioError);
  Player.getAudio().addEventListener('timeupdate', () => {
    if (Player.isThresholdReached()) {
      LibraryActions.incrementPlayCount(Player.getSrc());
    }
  });

  // Should be moved to PlayerActions.play at some point, currently here due to
  // how Audio works
  Player.getAudio().addEventListener('play', async () => {
    ipcRenderer.send('playback:play');

    // HACK, on win32, a prefix slash is weirdly added
    let trackPath = Player.getSrc();

    if (os.platform() === 'win32') {
      trackPath = trackPath.replace('file:///', '');
    } else {
      trackPath = trackPath.replace('file://', '');
    }

    trackPath = decodeURIComponent(trackPath);

    const track = await utils.getMetadata(trackPath);

    ipcRenderer.send('playback:trackChange', track);

    if(browserWindows.main.isFocused()) return;

    const cover = await utils.fetchCover(track.path);
    NotificationsActions.add({
      title: track.title,
      body: `${track.artist}\n${track.album}`,
      icon: cover,
    });
  });

  Player.getAudio().addEventListener('pause', () => {
    ipcRenderer.send('playback:pause');
  });

  // Listen for main-process events
  ipcRenderer.on('playback:play', () => {
    Player.getSrc() ? PlayerActions.play() : PlayerActions.start();
  });

  ipcRenderer.on('playback:pause', () => {
    PlayerActions.pause();
  });

  ipcRenderer.on('playback:playpause', () => {
    PlayerActions.playPause();
  });

  ipcRenderer.on('playback:previous', () => {
    PlayerActions.previous();
  });

  ipcRenderer.on('playback:next', () => {
    PlayerActions.next();
  });

  // Prevent some events
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  }, false);

  window.addEventListener('drop', (e) => {
    e.preventDefault();
  }, false);

  // Remember dimensions and positionning
  const currentWindow = browserWindows.main;

  currentWindow.on('resize', saveBounds);
  currentWindow.on('move', saveBounds);
};

const restart = () => {
  ipcRenderer.send('app:restart');
};

const close = () => {
  ipcRenderer.send('app:close');
};

const minimize = () => {
  browserWindows.main.minimize();
};

const maximize = () => {
  browserWindows.main.isMaximized() ? browserWindows.main.unmaximize() : browserWindows.main.maximize();
};

const saveBounds = () => {
  const now = window.performance.now();

  if (now - self.lastFilterSearch < 250) {
    clearTimeout(self.saveBoundTimeout);
  }

  self.lastFilterSearch = now;

  self.saveBoundTimeout = setTimeout(() => {
    config.set('bounds', browserWindows.main.getBounds());
    config.saveSync();
  }, 250);
};

export default {
  close,
  init,
  maximize,
  minimize,
  saveBounds,
  restart,
};
