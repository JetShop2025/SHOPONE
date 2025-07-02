require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

console.log('🚀 [STARTUP] Iniciando servidor...');

// CORS EXTREMO - MÁXIMA COMPATIBILIDAD
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Max-Age', '86400');
  
  console.log(`� [REQUEST] ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    console.log(`✅ [OPTIONS] Handled for ${req.url}`);
    return res.status(200).end();
  }
  
  next();
});

// CORS library config
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['*']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

console.log('✅ [STARTUP] Middleware configurado');

// ENDPOINTS DE DIAGNÓSTICO CRÍTICO - ANTES DE TODO
app.get('/', (req, res) => {
  console.log('🏠 [ROOT] Request received');
  res.json({ 
    status: 'Server is running',
    message: 'GraphicalSystem Backend v2.1',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/test', (req, res) => {
  console.log('🧪 [TEST] Request received');
  res.json({ test: 'OK', cors: 'working', timestamp: new Date().toISOString() });
});

app.get('/cors-test', (req, res) => {
  console.log('🔍 [CORS-TEST] Request received');
  res.json({ cors: 'working', origin: req.headers.origin, timestamp: new Date().toISOString() });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cors: 'configured for production',
    version: '2.1-render-ready',
    database: {
      host: process.env.MYSQL_HOST ? 'configured' : 'missing',
      user: process.env.MYSQL_USER ? 'configured' : 'missing',
      database: process.env.MYSQL_DATABASE ? 'configured' : 'missing'
    }
  });
});

// Database test endpoint
app.get('/test-db', async (req, res) => {
  try {
    const db = require('./db');
    const [result] = await db.query('SELECT 1 as test');
    res.json({ 
      dbStatus: 'OK', 
      result: result,
      env: {
        host: process.env.MYSQL_HOST || 'not set',
        user: process.env.MYSQL_USER || 'not set',
        database: process.env.MYSQL_DATABASE || 'not set',
        port: process.env.MYSQL_PORT || 'not set'
      }
    });
  } catch (err) {
    res.status(500).json({ dbStatus: 'ERROR', error: err.message });
  }
});

// Keep-alive endpoint para evitar que Render duerma el servidor
app.get('/keep-alive', async (req, res) => {
  console.log(`[${new Date().toISOString()}] Keep-alive ping received from ${req.ip}`);
  
  try {
    // Test database connection as part of keep-alive
    const db = require('./db');
    await db.query('SELECT 1');
    
    res.json({ 
      status: 'alive', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      memory: process.memoryUsage(),
      version: '2.1-render-ready'
    });
  } catch (err) {
    console.error('Keep-alive database test failed:', err.message);
    res.status(200).json({ 
      status: 'alive', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'error',
      dbError: err.message,
      memory: process.memoryUsage(),
      version: '2.1-render-ready'
    });
  }
});

// Servir archivos estáticos de React
// En desarrollo: ../build, En producción: ./build
const buildPath = path.join(__dirname, '../build');
const fs = require('fs');
const finalBuildPath = fs.existsSync(buildPath) ? buildPath : path.join(__dirname, './build');
app.use(express.static(finalBuildPath));

const auditRoutes = require('./routes/audit');
const trailasRoutes = require('./routes/trailers');
const workOrdersRouter = require('./routes/workOrders');
app.use('/api/work-orders', workOrdersRouter);

app.use('/api/trailas', trailasRoutes);
app.use('/pdfs', express.static(__dirname + '/pdfs'));
// Rutas
const inventoryRoutes = require('./routes/inventory');
const receiveRoutes = require('./routes/receive');
const loginRoutes = require('./routes/login');
const workOrderPartsRoutes = require('./routes/workOrderParts');
const trailerLocationRoutes = require('./routes/trailerLocation');

app.use('/api/inventory', inventoryRoutes);
app.use('/api/receive', receiveRoutes);
app.use('/api/login', loginRoutes);
app.use('/api/work-order-parts', workOrderPartsRoutes);
app.use('/api/trailer-location', trailerLocationRoutes);

app.use('/api/audit', auditRoutes);

// CORS Debug endpoint - para diagnosticar problemas de conectividad
app.all('/api/cors-test', (req, res) => {
  console.log(`🔍 [CORS-DEBUG] ${req.method} request from ${req.headers.origin}`);
  console.log(`🔍 [CORS-DEBUG] Headers:`, req.headers);
  
  res.json({
    success: true,
    message: 'CORS test successful',
    method: req.method,
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    headers: req.headers,
    cors: 'working'
  });
});

// Test endpoint básico sin API prefix
app.get('/cors-test', (req, res) => {
  console.log(`🔍 [CORS-BASIC] ${req.method} request from ${req.headers.origin}`);
  res.json({
    success: true,
    message: 'Basic CORS test successful',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin
  });
});

// Catch-all handler: envía de vuelta React's index.html file para cualquier ruta no API
app.get('*', (req, res) => {
  const indexPath = path.join(finalBuildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Build files not found');
  }
});

const PORT = process.env.PORT || 5050;

// MONITOR DE SISTEMA - Logging detallado para diagnóstico
console.log('🚀 ========================================');
console.log('🚀 INICIANDO SERVIDOR CON LOGGING DETALLADO');
console.log('🚀 ========================================');
console.log(`📊 Node.js Version: ${process.version}`);
console.log(`📊 Memoria inicial: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
console.log(`📊 Límite de memoria configurado: ${process.memoryUsage().rss / 1024 / 1024}MB`);
console.log(`📊 Puerto: ${PORT}`);
console.log(`📊 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`📊 Garbage Collector disponible: ${global.gc ? 'SÍ' : 'NO'}`);

// Monitor de memoria cada 30 segundos
setInterval(() => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);
  
  console.log(`📊 [MONITOR] Memoria - Heap: ${heapUsedMB}/${heapTotalMB}MB, RSS: ${rssMB}MB`);
  
  // Alerta si la memoria está alta
  if (heapUsedMB > 250) {
    console.log(`⚠️ [MONITOR] ALERTA: Memoria alta - ${heapUsedMB}MB`);
  }
}, 30000);

// Monitor de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('💀 [MONITOR] UNCAUGHT EXCEPTION:', error.message);
  console.error('💀 [MONITOR] Stack trace:', error.stack);
  console.error(`📊 [MONITOR] Memoria en crash: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💀 [MONITOR] UNHANDLED REJECTION:', reason);
  console.error('💀 [MONITOR] Promise:', promise);
  console.error(`📊 [MONITOR] Memoria en rejection: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en http://0.0.0.0:${PORT}`);
  console.log(`📊 Memoria después de iniciar: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log('🔍 SISTEMA LISTO PARA DIAGNÓSTICO DE CRASHES');
  console.log('🚀 ========================================');
  // Production version - CORS fixed and optimized - 2025-06-25
});

