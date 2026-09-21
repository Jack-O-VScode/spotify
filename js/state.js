// ---------------------------------------------------------------------------
// Tiny global pub-sub store. Playback state is polled in one place
// (player.js) and fanned out from here to whatever's currently on screen —
// the mini now-playing bar, the full-screen player sheet, and any view that
// wants to highlight the currently-playing row.
// ---------------------------------------------------------------------------

class Store extends EventTarget {
  constructor() {
    super();
    this.playback = null; // last GET /me/player response, or null if nothing active
    this.devices = []; // last GET /me/player/devices response
    this.selectedDeviceId = null;
  }

  setPlayback(playback) {
    this.playback = playback;
    this.dispatchEvent(new CustomEvent("playback"));
  }

  setDevices(devices) {
    this.devices = devices;
    this.dispatchEvent(new CustomEvent("devices"));
  }

  setSelectedDeviceId(deviceId) {
    this.selectedDeviceId = deviceId;
    try {
      if (deviceId) localStorage.setItem("spotify_remote_device_id", deviceId);
      else localStorage.removeItem("spotify_remote_device_id");
    } catch {
      // best-effort; selection still holds for this session
    }
    this.dispatchEvent(new CustomEvent("selected-device"));
  }

  loadPersistedDeviceId() {
    try {
      this.selectedDeviceId = localStorage.getItem("spotify_remote_device_id");
    } catch {
      this.selectedDeviceId = null;
    }
  }
}

export const store = new Store();
