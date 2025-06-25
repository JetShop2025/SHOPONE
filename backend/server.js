const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Aumenta el límite a 10mb (puedes ajustarlo según tus necesidades)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ¡Pon esto antes de cualquier app.use de rutas!
app.use(cors({ 
  origin: [
    'http://localhost:3000',
    'https://shopone.onrender.com',
    'https://shopone-1.onrender.com'
  ], 
  credentials: true 
}));

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
  // Force redeploy - Fix API URL issue - 2025-06-24
});

