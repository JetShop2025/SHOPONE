const express = require('express');
const cors = require('cors');
const path = require('path');

// Crear app express simple para servir archivos y probar
const app = express();
app.use(cors());
app.use(express.json());

// Importar rutas del backend
const workOrdersRoutes = require('./backend/routes/workOrders');
const workOrderPartsRoutes = require('./backend/routes/workOrderParts');

// Configurar rutas
app.use('/work-orders', workOrdersRoutes);
app.use('/work-order-parts', workOrderPartsRoutes);

// Servir archivos estáticos del build
app.use(express.static(path.join(__dirname, 'build')));

// Ruta catch-all para React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`\n🚀 SISTEMA DE PRUEBAS PDF/FIFO INICIADO`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔧 Backend API: http://localhost:${PORT}/work-orders`);
  console.log(`📊 Sistema FIFO: http://localhost:${PORT}/work-order-parts`);
  console.log(`\n✅ Para probar:`);
  console.log(`   1. Abrir http://localhost:${PORT} en tu navegador`);
  console.log(`   2. Crear una nueva Work Order con partes`);
  console.log(`   3. Verificar que el PDF se genere con links FIFO`);
  console.log(`   4. Verificar que el autocompletado funcione`);
  console.log(`\n🔍 Los logs aparecerán aquí para debug\n`);
});

// Manejo de errores
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Promesa rechazada:', err);
});
