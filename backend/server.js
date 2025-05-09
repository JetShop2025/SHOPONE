const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
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

const PORT = 5050;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

