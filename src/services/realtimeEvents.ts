const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';

let eventSource: EventSource | null = null;
let reconnectTimer: number | null = null;

function emitWindowEvent(name: string, detail: any) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function connectRealtime() {
  if (eventSource) return;

  try {
    eventSource = new EventSource(`${API_URL}/realtime/events`);

    eventSource.addEventListener('connected', () => {
      emitWindowEvent('realtimeConnected', { at: new Date().toISOString() });
    });

    eventSource.addEventListener('audit-change', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data || '{}');
        emitWindowEvent('systemDataChanged', payload);
      } catch (error) {
        console.error('[REALTIME] Invalid audit-change payload:', error);
      }
    });

    eventSource.addEventListener('system-change', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data || '{}');
        emitWindowEvent('systemDataChanged', payload);
      } catch (error) {
        console.error('[REALTIME] Invalid system-change payload:', error);
      }
    });

    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connectRealtime();
      }, 2000);
    };
  } catch (error) {
    console.error('[REALTIME] Could not connect to realtime events:', error);
  }
}

function initRealtimeEvents() {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return;
  }

  const guardKey = '__shoponeRealtimeInitialized';
  if ((window as any)[guardKey]) {
    return;
  }

  (window as any)[guardKey] = true;
  connectRealtime();
}

initRealtimeEvents();

export {};
