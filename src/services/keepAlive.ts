// Keep-alive service para mantener el servidor de Render activo
// TEMPORALMENTE DESHABILITADO PARA OPTIMIZAR MEMORIA

const KEEP_ALIVE_INTERVAL = 15 * 60 * 1000; // 15 minutos (reducido para memoria)
const PING_TIMEOUT = 10000; // 10 segundos timeout (reducido)
const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com';

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
  }

  // Método público para ping manual (usado por WorkOrdersTable)
  async manualPing(): Promise<boolean> {
    return this.ping();
  }

  private async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);

      const response = await fetch(`${API_URL}/keep-alive`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        this.consecutiveFailures = 0;
        console.log(`🏓 Keep-alive ping exitoso - Uptime: ${Math.round(data.uptime/60)}min, DB: ${data.database}`);
        return true;
      } else {
        this.consecutiveFailures++;
        console.warn(`⚠️ Keep-alive ping falló: ${response.status} (${this.consecutiveFailures}/${this.maxFailures})`);
        return false;
      }
    } catch (error: any) {
      this.consecutiveFailures++;
      if (error.name === 'AbortError') {
        console.error(`⏱️ Keep-alive ping timeout (${this.consecutiveFailures}/${this.maxFailures})`);
      } else {
        console.error(`❌ Error en keep-alive ping: ${error.message} (${this.consecutiveFailures}/${this.maxFailures})`);
      }
      
      // Si tenemos muchos fallos consecutivos, aumentar frecuencia temporalmente
      if (this.consecutiveFailures >= this.maxFailures) {
        console.log('🔄 Servidor puede estar dormido, aumentando frecuencia de ping...');
        this.increasePingFrequency();
      }
      
      return false;
    }
  }

  private increasePingFrequency() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      // Ping más frecuente por 5 minutos
      this.intervalId = setInterval(() => {
        this.ping();
      }, 2 * 60 * 1000); // 2 minutos
      
      // Volver a frecuencia normal después de 5 minutos
      setTimeout(() => {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = setInterval(() => {
            this.ping();
          }, KEEP_ALIVE_INTERVAL);
          console.log('🔄 Volviendo a frecuencia normal de keep-alive');
        }
      }, 5 * 60 * 1000);
    }
  }
}

export const keepAliveService = new KeepAliveService();

// Auto-iniciar el servicio en producción
if (process.env.NODE_ENV === 'production') {
  keepAliveService.start();
}
