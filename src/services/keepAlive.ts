// Keep-alive service para mantener el servidor de Render activo
// TEMPORALMENTE DESHABILITADO PARA OPTIMIZAR MEMORIA

const KEEP_ALIVE_INTERVAL = 15 * 60 * 1000; // 15 minutos (reducido para memoria)
const PING_TIMEOUT = 10000; // 10 segundos timeout (reducido)
const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';

class KeepAliveService {
  private intervalId: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  private maxFailures = 2; // Reducido para fallar más rápido

  start() {
    // DESHABILITADO TEMPORALMENTE PARA OPTIMIZAR MEMORIA
    console.log('⚠️ Keep-alive service deshabilitado temporalmente para optimizar memoria');
    return;
    
    if (this.intervalId) {
      return; // Ya está ejecutándose
    }

    console.log('🟢 Keep-alive service iniciado (intervalo: 15 min)');
    
    // Hacer ping inmediatamente
    this.ping();
    
    // Configurar ping cada 15 minutos
    this.intervalId = setInterval(() => {
      this.ping();
    }, KEEP_ALIVE_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.consecutiveFailures = 0;
      console.log('🔴 Keep-alive service detenido');
    }
  }  // Método público para ping manual - DESHABILITADO PARA OPTIMIZAR MEMORIA
  async manualPing(): Promise<boolean> {
    console.log('⚠️ Manual ping deshabilitado para optimizar memoria');
    return true; // Siempre retorna true para no romper el UI
  }

  private async ping(): Promise<boolean> {
    // COMPLETAMENTE DESHABILITADO PARA OPTIMIZAR MEMORIA
    console.log('⚠️ Ping deshabilitado para optimizar memoria');
    return true;
  }

  // Método deshabilitado pero mantenido para compatibilidad
  private increasePingFrequency() {
    console.log('⚠️ increasePingFrequency deshabilitado para optimizar memoria');
    return;
  }
}

export const keepAliveService = new KeepAliveService();

// Auto-iniciar el servicio en producción
if (process.env.NODE_ENV === 'production') {
  keepAliveService.start();
}
