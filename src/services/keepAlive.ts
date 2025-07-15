// Keep-alive service para mantener el servidor de Render activo
// REACTIVADO PARA SOLUCIONAR PROBLEMA DE SERVIDOR DORMIDO

const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutos
const PING_TIMEOUT = 30000; // 30 segundos timeout (más tiempo para despertar)
const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';

class KeepAliveService {
  private intervalId: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  private maxFailures = 3;

  start() {
    if (this.intervalId) {
      return; // Ya está ejecutándose
    }

    console.log('🟢 Keep-alive service iniciado (intervalo: 10 min)');
    
    // Hacer ping inmediatamente
    this.ping();
    
    // Configurar ping cada 10 minutos
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
  }  // Método público para ping manual - REACTIVADO PARA DESPERTAR SERVIDOR
  async manualPing(): Promise<boolean> {
    console.log('� Intentando despertar servidor manualmente...');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);
      
      const response = await fetch(`${API_URL}/ping`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ Servidor despertado exitosamente');
        this.consecutiveFailures = 0;
        return true;
      } else {
        console.log('⚠️ Servidor respondió pero con error:', response.status);
        return false;
      }
    } catch (error: any) {
      console.log('⚠️ Error en manual ping (normal si el servidor está iniciando):', error.message);
      return false;
    }
  }

  private async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);
      
      const response = await fetch(`${API_URL}/ping`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ Keep-alive ping exitoso');
        this.consecutiveFailures = 0;
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      this.consecutiveFailures++;
      console.log(`❌ Keep-alive ping falló (${this.consecutiveFailures}/${this.maxFailures}):`, error.message);
      
      if (this.consecutiveFailures >= this.maxFailures) {
        console.log('🔴 Demasiados fallos consecutivos, deteniendo keep-alive');
        this.stop();
      }
      
      return false;
    }
  }

  // Método deshabilitado pero mantenido para compatibilidad
  private increasePingFrequency() {
    console.log('⚠️ increasePingFrequency deshabilitado para optimizar memoria');
    return;
  }
}

export const keepAliveService = new KeepAliveService();

// Auto-iniciar el servicio siempre para mantener el servidor despierto
console.log('🚀 Iniciando keep-alive service para evitar que el servidor se duerma...');
keepAliveService.start();
