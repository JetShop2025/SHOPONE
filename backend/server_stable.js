require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

console.log('[STARTUP] Iniciando servidor...');

// CORS configuration
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['*']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

console.log('[STARTUP] Middleware configurado');

// Request logging
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// Database module
const db = require('./db');
console.log('[STARTUP] Database module loaded');

// HEALTH CHECK
app.get('/api/status', (req, res) => {
  console.log('[STATUS] Request received');
  res.json({ 
    status: 'Server is running',
    message: 'GraphicalSystem Backend v2.1',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/test', (req, res) => {
  console.log('[TEST] Request received');
  res.json({ success: true, message: 'Test endpoint working' });
});

// LOGIN ENDPOINT
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('[LOGIN] Request received for user:', username);
    
    // Simple authentication
    if (username === 'admin' && password === 'admin') {
      console.log('[LOGIN] Admin login successful');
      res.json({ success: true });
      return;
    }
    
    // Fallback authentication
    if (username && password && username.length > 0 && password.length > 0) {
      console.log('[LOGIN] Fallback authentication successful');
      res.json({ success: true });
    } else {
      console.log('[LOGIN] Authentication failed');
      res.json({ success: false });
    }
  } catch (error) {
    console.error('[ERROR] POST /api/login:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// TRAILERS ENDPOINTS
app.get('/api/trailers', async (req, res) => {
  try {
    console.log('[GET] /api/trailers - Fetching all trailers');
    const trailers = await db.getTrailers();
    console.log(`[GET] /api/trailers - Found ${trailers.length} trailers`);
    res.json(trailers);
  } catch (error) {
    console.error('[ERROR] GET /api/trailers:', error);
    res.status(500).json({ error: 'Failed to fetch trailers' });
  }
});

app.post('/api/trailers', async (req, res) => {
  try {
    console.log('[POST] /api/trailers - Creating trailer:', req.body);
    const trailer = await db.createTrailer(req.body);
    console.log('[POST] /api/trailers - Created trailer:', trailer);
    res.json(trailer);
  } catch (error) {
    console.error('[ERROR] POST /api/trailers:', error);
    res.status(500).json({ error: 'Failed to create trailer' });
  }
});

app.put('/api/trailers/:id', async (req, res) => {
  try {
    console.log(`[PUT] /api/trailers/${req.params.id} - Updating trailer:`, req.body);
    const trailer = await db.updateTrailer(req.params.id, req.body);
    console.log(`[PUT] /api/trailers/${req.params.id} - Updated trailer:`, trailer);
    res.json(trailer);
  } catch (error) {
    console.error(`[ERROR] PUT /api/trailers/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update trailer' });
  }
});

app.delete('/api/trailers/:id', async (req, res) => {
  try {
    console.log(`[DELETE] /api/trailers/${req.params.id} - Deleting trailer`);
    await db.deleteTrailer(req.params.id);
    console.log(`[DELETE] /api/trailers/${req.params.id} - Deleted successfully`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[ERROR] DELETE /api/trailers/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete trailer' });
  }
});

// TRAILAS ENDPOINTS (alias for trailers)
app.get('/api/trailas', async (req, res) => {
  try {
    console.log('[GET] /api/trailas - Fetching all trailas');
    const trailers = await db.getTrailers();
    console.log(`[GET] /api/trailas - Found ${trailers.length} trailas`);
    res.json(trailers);
  } catch (error) {
    console.error('[ERROR] GET /api/trailas:', error);
    res.status(500).json({ error: 'Failed to fetch trailas' });
  }
});

app.post('/api/trailas', async (req, res) => {
  try {
    console.log('[POST] /api/trailas - Creating traila:', req.body);
    const traila = await db.createTrailer(req.body);
    console.log('[POST] /api/trailas - Created traila:', traila);
    res.json(traila);
  } catch (error) {
    console.error('[ERROR] POST /api/trailas:', error);
    res.status(500).json({ error: 'Failed to create traila' });
  }
});

// INVENTORY ENDPOINTS
app.get('/api/inventory', async (req, res) => {
  try {
    console.log('[GET] /api/inventory - Fetching all inventory items');
    const partes = await db.getPartes();
    console.log(`[GET] /api/inventory - Found ${partes.length} items`);
    res.json(partes);
  } catch (error) {
    console.error('[ERROR] GET /api/inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    console.log('[POST] /api/inventory - Creating inventory item:', req.body);
    const parte = await db.createParte(req.body);
    console.log('[POST] /api/inventory - Created item:', parte);
    res.json(parte);
  } catch (error) {
    console.error('[ERROR] POST /api/inventory:', error);
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  try {
    console.log(`[PUT] /api/inventory/${req.params.id} - Updating inventory item:`, req.body);
    const parte = await db.updateParte(req.params.id, req.body);
    console.log(`[PUT] /api/inventory/${req.params.id} - Updated item:`, parte);
    res.json(parte);
  } catch (error) {
    console.error(`[ERROR] PUT /api/inventory/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    console.log(`[DELETE] /api/inventory/${req.params.id} - Deleting inventory item`);
    await db.deleteParte(req.params.id);
    console.log(`[DELETE] /api/inventory/${req.params.id} - Deleted successfully`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[ERROR] DELETE /api/inventory/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

// WORK ORDERS ENDPOINTS
app.get('/api/work-orders', async (req, res) => {
  try {
    console.log('[GET] /api/work-orders - Fetching all work orders');
    const orders = await db.getOrders();
    console.log(`[GET] /api/work-orders - Found ${orders.length} work orders`);
    res.json(orders);
  } catch (error) {
    console.error('[ERROR] GET /api/work-orders:', error);
    res.status(500).json({ error: 'Failed to fetch work orders' });
  }
});

app.post('/api/work-orders', async (req, res) => {
  try {
    console.log('[POST] /api/work-orders - Creating work order:', req.body);
    const order = await db.createOrder(req.body);
    console.log('[POST] /api/work-orders - Created work order:', order);
    res.json(order);
  } catch (error) {
    console.error('[ERROR] POST /api/work-orders:', error);
    res.status(500).json({ error: 'Failed to create work order' });
  }
});

// TRAILER LOCATION ENDPOINTS
app.get('/api/trailer-locations', async (req, res) => {
  try {
    console.log('[GET] /api/trailer-locations - Fetching all locations');
    const locations = await db.getTrailerLocations();
    console.log(`[GET] /api/trailer-locations - Found ${locations.length} locations`);
    res.json(locations);
  } catch (error) {
    console.error('[ERROR] GET /api/trailer-locations:', error);
    res.status(500).json({ error: 'Failed to fetch trailer locations' });
  }
});

app.post('/api/trailer-locations', async (req, res) => {
  try {
    console.log('[POST] /api/trailer-locations - Creating location:', req.body);
    const location = await db.createTrailerLocation(req.body);
    console.log('[POST] /api/trailer-locations - Created location:', location);
    res.json(location);
  } catch (error) {
    console.error('[ERROR] POST /api/trailer-locations:', error);
    res.status(500).json({ error: 'Failed to create trailer location' });
  }
});

// RECEIVE ENDPOINTS
app.get('/api/receive', async (req, res) => {
  try {
    const { estatus } = req.query;
    console.log(`[GET] /api/receive - Fetching receive data with status: ${estatus}`);
    const pendingParts = await db.getPendingParts();
    console.log(`[GET] /api/receive - Found ${pendingParts.length} pending parts`);
    res.json(pendingParts);
  } catch (error) {
    console.error('[ERROR] GET /api/receive:', error);
    res.status(500).json({ error: 'Failed to fetch receive data' });
  }
});

// PENDING PARTS ENDPOINTS
app.get('/api/pending-parts', async (req, res) => {
  try {
    console.log('[GET] /api/pending-parts - Fetching pending parts');
    const pendingParts = await db.getPendingParts();
    console.log(`[GET] /api/pending-parts - Found ${pendingParts.length} pending parts`);
    res.json(pendingParts);
  } catch (error) {
    console.error('[ERROR] GET /api/pending-parts:', error);
    res.status(500).json({ error: 'Failed to fetch pending parts' });
  }
});

// PDF GENERATION ENDPOINT
app.post('/api/generate-pdf', async (req, res) => {
  try {
    console.log('[POST] /api/generate-pdf - Generating PDF:', req.body);
    const pdfPath = await db.generatePDF(req.body);
    console.log('[POST] /api/generate-pdf - PDF generated:', pdfPath);
    res.json({ success: true, pdfPath });
  } catch (error) {
    console.error('[ERROR] POST /api/generate-pdf:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// STATIC FILES - Build de React
app.use(express.static(path.join(__dirname, '../build')));

// CATCH ALL - Para React Router
app.get('*', (req, res) => {
  console.log(`[CATCH-ALL] Serving React app for: ${req.url}`);
  res.sendFile(path.join(__dirname, '../build/index.html'));
});

// ERROR HANDLER
app.use((error, req, res, next) => {
  console.error('[ERROR HANDLER]:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[STARTUP] Servidor funcionando en puerto ${PORT}`);
  console.log(`[STARTUP] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[STARTUP] Tiempo de inicio: ${new Date().toISOString()}`);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] Cerrando servidor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Cerrando servidor por SIGTERM...');
  process.exit(0);
});
