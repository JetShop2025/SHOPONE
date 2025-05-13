const express = require('express');
const cors = require('cors');
const app = express();

// ¡Pon esto antes de cualquier app.use de rutas!
app.use(cors({
  origin: ['https://shopone-1.onrender.com', 'http://localhost:3000'],
  credentials: true
}));

const auditRoutes = require('./routes/audit');
const trailasRoutes = require('./routes/trailers');

app.use('/trailas', trailasRoutes);
app.use('/pdfs', express.static(__dirname + '/pdfs'));
// Rutas
const inventoryRoutes = require('./routes/inventory');
const workOrdersRoutes = require('./routes/workOrders');
const receiveRoutes = require('./routes/receive');
const loginRoutes = require('./routes/login');

app.use('/inventory', inventoryRoutes);
app.use('/work-orders', workOrdersRoutes);
app.use('/receive', receiveRoutes);
app.use('/login', loginRoutes);

app.use('/audit', auditRoutes);

const PORT = process.env.PORT || 5050;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});

