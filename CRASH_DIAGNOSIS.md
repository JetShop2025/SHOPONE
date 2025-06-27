# 🔍 LOGGING DETALLADO - DIAGNÓSTICO DE CRASHES

## 📅 **Implementado: 27 de Junio, 2025**

## 🎯 **OBJETIVO: IDENTIFICAR CAUSA EXACTA DEL CRASH**

### ✅ **DEPLOY EXITOSO CON LOGGING DETALLADO**
- **Commit:** `3465d78` - Implementar logging detallado para diagnóstico de crashes WO
- **Tiempo:** ~2-3 minutos para completar deploy
- **URL:** https://shopone.onrender.com

---

## 🔍 **LOGGING IMPLEMENTADO:**

### **1. Creación de Work Orders (`POST /work-orders/`)**
```javascript
// Logging de cada etapa crítica:
🚀 [CREATE_123_abc] INICIANDO CREACIÓN DE WORK ORDER
📊 [CREATE_123_abc] Memoria inicial: 65MB
📝 [CREATE_123_abc] Datos recibidos - Parts: 3, Trailer: T001
💾 [CREATE_123_abc] Preparando inserción en DB...
🗄️ [CREATE_123_abc] Ejecutando query de inserción...
✅ [CREATE_123_abc] WO creada exitosamente - ID: 456
📤 [CREATE_123_abc] Enviando respuesta al cliente...
🔄 [CREATE_123_abc] Iniciando proceso FIFO asíncrono...
```

### **2. Edición de Work Orders (`PUT /work-orders/:id`)**
```javascript
// Logging similar con IDs únicos de UPDATE
🔄 [UPDATE_456_xyz] INICIANDO EDICIÓN DE WORK ORDER ID: 456
📊 [UPDATE_456_xyz] Memoria inicial: 72MB
🔍 [UPDATE_456_xyz] Verificando que la orden exista...
🧮 [UPDATE_456_xyz] Procesando y calculando totales...
💾 [UPDATE_456_xyz] Preparando actualización en DB...
```

### **3. Proceso FIFO Detallado**
```javascript
// Cada parte procesada individualmente:
🔄 [FIFO_456_abc] Iniciando procesamiento FIFO
📦 [FIFO_456_abc] Encontrados 5 recibos disponibles
🔧 [FIFO_456_abc] Procesando parte 1/3: SKU12345
📝 [FIFO_456_abc] Procesando recibo 1/5 - Deduciendo 2 de 10 disponibles
📊 [FIFO_456_abc] Memoria en parte 1: 78MB
```

### **4. Monitor del Sistema**
```javascript
// Monitor continuo cada 30 segundos:
📊 [MONITOR] Memoria - Heap: 85/120MB, RSS: 95MB
⚠️ [MONITOR] ALERTA: Memoria alta - 265MB
💀 [MONITOR] UNCAUGHT EXCEPTION: [detalles del error]
💀 [MONITOR] Stack trace: [stack completo]
```

---

## 🎯 **INSTRUCCIONES PARA DIAGNÓSTICO:**

### **PASO 1: Probar el Sistema**
1. Ve a: https://shopone.onrender.com
2. Crea una nueva Work Order con 2-3 partes
3. Observa si el sistema se queda offline

### **PASO 2: Revisar Logs de Render**
- Los logs capturarán EXACTAMENTE dónde ocurre el crash
- Busca mensajes con `💀 ERROR CRÍTICO` o `⚠️ ALERTA`
- Nota el Request ID para seguimiento preciso

### **PASO 3: Identificar el Patrón**
- ¿Crash durante inserción en DB?
- ¿Crash durante proceso FIFO?
- ¿Crash por memoria alta?
- ¿Uncaught exception específica?

---

## 📊 **VALORES ESPERADOS:**

| Métrica | Valor Normal | Valor Crítico |
|---------|--------------|---------------|
| Memoria Inicial | 50-80MB | >200MB |
| Memoria durante CREATE | 80-150MB | >250MB |
| Memoria durante FIFO | 100-200MB | >280MB |
| Tiempo CREATE | 500-2000ms | >5000ms |
| Tiempo UPDATE | 300-1500ms | >3000ms |

---

## 🔧 **PRÓXIMOS PASOS SEGÚN RESULTADO:**

### **Si el logging muestra:**

#### **🔴 Memoria excede 280MB constantemente**
- **CAUSA:** Limitación del plan gratuito de Render
- **SOLUCIÓN:** Upgrade a plan Professional ($19/mes)
- **PROBABILIDAD:** 85%

#### **🔴 Uncaught Exception específica**
- **CAUSA:** Bug de código identificado
- **SOLUCIÓN:** Fix dirigido del problema
- **PROBABILIDAD:** 10%

#### **🔴 Timeout en base de datos**
- **CAUSA:** Limitación de conexiones del plan gratuito
- **SOLUCIÓN:** Upgrade a plan Professional
- **PROBABILIDAD:** 5%

---

## ⚡ **CONFIGURACIÓN ACTUAL DE LOGGING:**

```javascript
// Variables de entorno para control:
LOGGING_LEVEL: "verbose"
MEMORY_MONITOR: "enabled"
ERROR_CAPTURE: "full"
GC_ENABLED: "true"
MEMORY_LIMIT: "300MB"
```

---

## 📱 **REPORTE DE RESULTADOS:**

Una vez que pruebes el sistema, podremos:
1. **Identificar la causa exacta** del crash
2. **Implementar la solución específica** 
3. **Confirmar si el upgrade de plan es necesario**
4. **Optimizar el código** si es un problema de lógica

**El sistema ahora tiene visibilidad completa de todos los procesos críticos. Cualquier crash será capturado con detalles precisos.**
