const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// CORS configuration - DEBE estar ANTES de cualquier middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Permite requests sin origin (como Postman) y desde dominios específicos
    const allowedOrigins = [
      'https://shopone-1.onrender.com',
      'https://shopone.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // TEMPORALMENTE PERMITIR TODOS PARA DEBUGGING URGENTE
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'Access-Control-Allow-Origin'],
  preflightContinue: false,
  optionsSuccessStatus: 200
};

// Aplicar CORS antes que cualquier otra cosa
app.use(cors(corsOptions));

// Middleware adicional para CORS manual
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Aumenta el límite a 10mb (puedes ajustarlo según tus necesidades)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    cors: 'enabled for all origins - emergency mode',
    version: '2.0-emergency-fix'
  });
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
app.use('/work-orders', workOrdersRouter);

app.use('/trailas', trailasRoutes);
app.use('/pdfs', express.static(__dirname + '/pdfs'));
// Rutas
const inventoryRoutes = require('./routes/inventory');
const receiveRoutes = require('./routes/receive');
const loginRoutes = require('./routes/login');
const workOrderPartsRoutes = require('./routes/workOrderParts');

app.use('/inventory', inventoryRoutes);
app.use('/receive', receiveRoutes);
app.use('/login', loginRoutes);
app.use('/work-order-parts', workOrderPartsRoutes);

app.use('/audit', auditRoutes);

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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
  // Production version - CORS fixed and optimized - 2025-06-25
});

