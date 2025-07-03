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

// ENDPOINTS DE DIAGNÓSTICO CRÍTICO - CON PREFIJO API
app.get('/api/status', (req, res) => {
  console.log('🏠 [STATUS] Request received');
  res.json({ 
    status: 'Server is running',
    message: 'GraphicalSystem Backend v2.1',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/test', (req, res) => {
  console.log('🧪 [TEST] Request received');
  res.json({ test: 'OK', cors: 'working', timestamp: new Date().toISOString() });
});

app.get('/api/cors-test', (req, res) => {
  console.log('🔍 [CORS-TEST] Request received');
  res.json({ cors: 'working', origin: req.headers.origin, timestamp: new Date().toISOString() });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
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
app.get('/api/test-db', async (req, res) => {
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
app.get('/api/keep-alive', async (req, res) => {
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

console.log(`📁 [STATIC] Serving React build from: ${finalBuildPath}`);
console.log(`📁 [STATIC] Build exists: ${fs.existsSync(finalBuildPath)}`);

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
app.all('/api/cors-debug', (req, res) => {
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

// Ruta especial para servir el React app desde el backend (para Render)
app.get('/app', (req, res) => {
  const reactAppPath = path.join(__dirname, '../src/index.tsx');
  
  // Si no tenemos build, servir una página que cargue el desarrollo
  const fallbackHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sistema Gráfico V2 - Modernizado</title>
    <style>
        body { margin: 0; font-family: 'Courier New', monospace; }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
        }
        .header {
            text-align: center;
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .header h1 { color: #1976d2; font-size: 36px; margin: 0; }
        .status { 
            background: #e8f5e8; 
            color: #2e7d32; 
            padding: 16px; 
            border-radius: 12px; 
            margin: 20px 0;
            text-align: center;
            font-weight: 600;
        }
        .login-form {
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
            max-width: 400px;
            margin: 0 auto;
        }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; }
        input { 
            width: 100%; 
            padding: 12px; 
            border: 2px solid #e0e0e0; 
            border-radius: 8px;
            font-size: 16px;
            box-sizing: border-box;
        }
        input:focus { outline: none; border-color: #1976d2; }
        .btn {
            width: 100%;
            background: linear-gradient(135deg, #1976d2, #1565c0);
            color: white;
            border: none;
            padding: 14px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .btn:hover { transform: translateY(-2px); }
        .nav-links {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-top: 30px;
        }
        .nav-link {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
            text-align: center;
            text-decoration: none;
            color: #1976d2;
            font-weight: 600;
            transition: all 0.2s ease;
        }
        .nav-link:hover { transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚛 SISTEMA GRÁFICO V2</h1>
            <p>Sistema Modernizado - Deploy en Render</p>
        </div>
        
        <div class="status">
            ✅ Backend funcionando correctamente • UI/UX Modernizada • Trailer Control Actualizado
        </div>
        
        <div class="login-form">
            <h2 style="text-align: center; color: #1976d2; margin-bottom: 20px;">🔐 Acceso al Sistema</h2>
            <form onsubmit="login(event)">
                <div class="form-group">
                    <label>👤 Usuario:</label>
                    <input type="text" id="username" required>
                </div>
                <div class="form-group">
                    <label>🔐 Contraseña:</label>
                    <input type="password" id="password" required>
                </div>
                <button type="submit" class="btn">🚀 INGRESAR</button>
            </form>
            <div id="message" style="margin-top: 15px; text-align: center;"></div>
        </div>
        
        <div class="nav-links">
            <a href="/api/test" class="nav-link">🧪 Test API</a>
            <a href="/api/health" class="nav-link">💚 Health Check</a>
            <a href="/api/trailas" class="nav-link">🚛 Trailers API</a>
            <a href="/api/work-orders" class="nav-link">🔧 Work Orders</a>
        </div>
    </div>
    
    <script>
        async function login(event) {
            event.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const messageDiv = document.getElementById('message');
            
            messageDiv.innerHTML = '<div style="color: #1976d2;">🔄 Validando...</div>';
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                if (response.ok) {
                    messageDiv.innerHTML = '<div style="color: #2e7d32;">✅ Acceso autorizado</div>';
                    localStorage.setItem('username', username);
                    localStorage.setItem('isAuthenticated', 'true');
                    setTimeout(() => showMainMenu(), 1000);
                } else {
                    messageDiv.innerHTML = '<div style="color: #d32f2f;">❌ Credenciales incorrectas</div>';
                }
            } catch (error) {
                messageDiv.innerHTML = '<div style="color: #d32f2f;">❌ Error de conexión</div>';
            }
        }
        
        function showMainMenu() {
            document.querySelector('.container').innerHTML = \`
                <div class="header">
                    <h1>🚛 MENÚ PRINCIPAL</h1>
                    <p>Sistema Gráfico V2 - Modernizado</p>
                </div>
                <div class="nav-links">
                    <a href="#" onclick="loadComponent('trailas')" class="nav-link">
                        🚛 TRAILER CONTROL<br><small>Gestión de rentas modernizada</small>
                    </a>
                    <a href="#" onclick="loadComponent('work-orders')" class="nav-link">
                        🔧 WORK ORDERS<br><small>Órdenes de trabajo</small>
                    </a>
                    <a href="#" onclick="loadComponent('inventory')" class="nav-link">
                        📦 INVENTARIO<br><small>Control de partes</small>
                    </a>
                    <a href="#" onclick="loadComponent('trailer-location')" class="nav-link">
                        📍 TRAILER LOCATION<br><small>Ubicación de trailers</small>
                    </a>
                    <a href="#" onclick="loadComponent('audit')" class="nav-link">
                        📊 AUDITORÍA<br><small>Logs del sistema</small>
                    </a>
                </div>
                <div style="text-align: center; margin-top: 30px;">
                    <button onclick="logout()" style="background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                        🚪 Cerrar Sesión
                    </button>
                </div>
            \`;
        }
        
        function loadComponent(component) {
            alert('🎉 Componente ' + component + ' se cargaría aquí.\\n\\nEn el deploy completo de React, estos enlaces abrirían las interfaces modernizadas.');
        }
        
        function logout() {
            localStorage.clear();
            location.reload();
        }
        
        // Verificar si ya está logueado
        if (localStorage.getItem('isAuthenticated') === 'true') {
            showMainMenu();
        }
    </script>
</body>
</html>`;
  
  res.send(fallbackHTML);
});

// Catch-all handler: send back React's index.html file for SPA routing
app.get('*', (req, res) => {
  const indexPath = path.join(finalBuildPath, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Si no hay build, redirigir a la app del backend
    res.redirect('/app');
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

