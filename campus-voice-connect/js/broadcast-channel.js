/**
 * Campus Voice Connect - Cross-Tab / Cross-Window Synchronization Service
 * Uses BroadcastChannel with localStorage fallback to keep Faculty and Classroom views in sync.
 */

export class CampusBroadcastService {
  constructor() {
    this.channelName = 'campus_voice_connect_v1';
    this.broadcastChannel = null;
    this.listeners = new Map();

    this.initChannel();
  }

  initChannel() {
    if ('BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(this.channelName);
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncoming(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel error, falling back to localStorage events', e);
      }
    }

    // Fallback: Listen to storage events across tabs
    window.addEventListener('storage', (event) => {
      if (event.key === this.channelName && event.newValue) {
        try {
          const payload = JSON.parse(event.newValue);
          this.handleIncoming(payload);
        } catch (err) {
          console.error('Failed to parse storage event payload', err);
        }
      }
    });
  }

  handleIncoming(payload) {
    if (!payload || !payload.type) return;
    const callbacks = this.listeners.get(payload.type) || [];
    callbacks.forEach(cb => {
      try { cb(payload.data); } catch (e) { console.error(e); }
    });

    // Also trigger wildcards
    const anyCallbacks = this.listeners.get('*') || [];
    anyCallbacks.forEach(cb => {
      try { cb(payload); } catch (e) { console.error(e); }
    });
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);

    return () => {
      const list = this.listeners.get(eventType) || [];
      const idx = list.indexOf(callback);
      if (idx !== -1) list.splice(idx, 1);
    };
  }

  send(type, data = {}) {
    const payload = {
      type,
      data,
      timestamp: Date.now(),
      senderId: window.__campus_tab_id || (window.__campus_tab_id = Math.random().toString(36).substring(2, 9))
    };

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(payload);
    }

    // Storage fallback for cross-tab
    try {
      localStorage.setItem(this.channelName, JSON.stringify(payload));
    } catch (e) {
      // quota or local storage restriction
    }

    // Also dispatch locally in same window/frame for split-screen demo
    this.handleIncoming(payload);
  }
}

export const campusBroadcast = new CampusBroadcastService();
