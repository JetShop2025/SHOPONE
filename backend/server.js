const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

console.log('[STARTUP] Starting server with database connection...');

// Import database functions
const db = require('./db');

// CORS configuration
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// DIAGNOSTIC ENDPOINTS
app.get('/api/status', (req, res) => {
  console.log('[STATUS] Request received');
  res.json({ 
    status: 'Server is running',
    message: 'GraphicalSystem Backend v2.0 - CONNECTED TO REAL DATABASE',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/health', (req, res) => {
  console.log('[HEALTH] Health check');
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// LOGIN ENDPOINT
app.post('/api/login', (req, res) => {
  console.log('[LOGIN] Login attempt:', req.body);
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'admin') {
    res.json({ 
      success: true, 
      token: 'mock-token-123',
      user: { username: 'admin', role: 'admin' }
    });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// TRAILERS ENDPOINTS - USING REAL DATABASE
app.get('/api/trailers', async (req, res) => {
  try {
    console.log('[GET] /api/trailers - Fetching from database');
    const trailers = await db.getTrailers();
    console.log(`[GET] /api/trailers - Found ${trailers.length} trailers from database`);
    res.json(trailers);
  } catch (error) {
    console.error('[ERROR] GET /api/trailers:', error);
    res.status(500).json({ error: 'Failed to fetch trailers from database' });
  }
});

app.get('/api/trailas', async (req, res) => {
  try {
    console.log('[GET] /api/trailas - Fetching from database');
    const trailers = await db.getTrailers();
    console.log(`[GET] /api/trailas - Found ${trailers.length} trailers from database`);
    res.json(trailers);
  } catch (error) {
    console.error('[ERROR] GET /api/trailas:', error);
    res.status(500).json({ error: 'Failed to fetch trailers from database' });
  }
});

app.post('/api/trailers', async (req, res) => {
  try {
    console.log('[POST] /api/trailers - Creating in database:', req.body);
    const newTrailer = await db.createTrailer(req.body);
    console.log('[POST] /api/trailers - Created in database:', newTrailer);
    res.json(newTrailer);
  } catch (error) {
    console.error('[ERROR] POST /api/trailers:', error);
    res.status(500).json({ error: 'Failed to create trailer in database' });
  }
});

app.post('/api/trailas', async (req, res) => {
  try {
    console.log('[POST] /api/trailas - Creating in database:', req.body);
    const newTrailer = await db.createTrailer(req.body);
    console.log('[POST] /api/trailas - Created in database:', newTrailer);
    res.json(newTrailer);
  } catch (error) {
    console.error('[ERROR] POST /api/trailas:', error);
    res.status(500).json({ error: 'Failed to create trailer in database' });
  }
});

app.put('/api/trailers/:id', async (req, res) => {
  try {
    console.log(`[PUT] /api/trailers/${req.params.id} - Updating in database:`, req.body);
    const updatedTrailer = await db.updateTrailer(req.params.id, req.body);
    console.log(`[PUT] /api/trailers/${req.params.id} - Updated in database:`, updatedTrailer);
    res.json(updatedTrailer);
  } catch (error) {
    console.error(`[ERROR] PUT /api/trailers/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update trailer in database' });
  }
});

app.put('/api/trailas/:id', async (req, res) => {
  try {
    console.log(`[PUT] /api/trailas/${req.params.id} - Updating in database:`, req.body);
    const updatedTrailer = await db.updateTrailer(req.params.id, req.body);
    console.log(`[PUT] /api/trailas/${req.params.id} - Updated in database:`, updatedTrailer);
    res.json(updatedTrailer);
  } catch (error) {
    console.error(`[ERROR] PUT /api/trailas/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update trailer in database' });
  }
});

app.delete('/api/trailers/:id', async (req, res) => {
  try {
    console.log(`[DELETE] /api/trailers/${req.params.id} - Deleting from database`);
    await db.deleteTrailer(req.params.id);
    console.log(`[DELETE] /api/trailers/${req.params.id} - Deleted from database`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[ERROR] DELETE /api/trailers/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete trailer from database' });
  }
});

app.delete('/api/trailas/:id', async (req, res) => {
  try {
    console.log(`[DELETE] /api/trailas/${req.params.id} - Deleting from database`);
    await db.deleteTrailer(req.params.id);
    console.log(`[DELETE] /api/trailas/${req.params.id} - Deleted from database`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[ERROR] DELETE /api/trailas/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete trailer from database' });
  }
});

// TRAILER LOCATIONS ENDPOINTS - USING REAL DATABASE
app.get('/api/trailer-locations', async (req, res) => {
  try {
    console.log('[GET] /api/trailer-locations - Fetching from database');
    const locations = await db.getTrailerLocations();
    console.log(`[GET] /api/trailer-locations - Found ${locations.length} locations from database`);
    res.json(locations);
  } catch (error) {
    console.error('[ERROR] GET /api/trailer-locations:', error);
    res.status(500).json({ error: 'Failed to fetch trailer locations from database' });
  }
});

app.post('/api/trailer-locations', async (req, res) => {
  try {
    console.log('[POST] /api/trailer-locations - Creating in database:', req.body);
    const newLocation = await db.createTrailerLocation(req.body);
    console.log('[POST] /api/trailer-locations - Created in database:', newLocation);
    res.json(newLocation);
  } catch (error) {
    console.error('[ERROR] POST /api/trailer-locations:', error);
    res.status(500).json({ error: 'Failed to create trailer location in database' });
  }
});

app.put('/api/trailer-locations/:id', async (req, res) => {
  try {
    console.log(`[PUT] /api/trailer-locations/${req.params.id} - Updating in database:`, req.body);
    const updatedLocation = await db.updateTrailerLocation(req.params.id, req.body);
    console.log(`[PUT] /api/trailer-locations/${req.params.id} - Updated in database:`, updatedLocation);
    res.json(updatedLocation);
  } catch (error) {
    console.error(`[ERROR] PUT /api/trailer-locations/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update trailer location in database' });
  }
});

app.delete('/api/trailer-locations/:id', async (req, res) => {
  try {
    console.log(`[DELETE] /api/trailer-locations/${req.params.id} - Deleting from database`);
    await db.deleteTrailerLocation(req.params.id);
    console.log(`[DELETE] /api/trailer-locations/${req.params.id} - Deleted from database`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[ERROR] DELETE /api/trailer-locations/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete trailer location from database' });
  }
});

// INVENTORY ENDPOINTS - USING REAL DATABASE
app.get('/api/inventory', async (req, res) => {
  try {
    console.log('[GET] /api/inventory - Fetching from database');
    const partes = await db.getPartes();
    console.log(`[GET] /api/inventory - Found ${partes.length} items from database`);
    res.json(partes);
  } catch (error) {
    console.error('[ERROR] GET /api/inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory from database' });
  }
});

app.get('/api/partes', async (req, res) => {
  try {
    console.log('[GET] /api/partes - Fetching from database');
    const partes = await db.getPartes();
    console.log(`[GET] /api/partes - Found ${partes.length} items from database`);
    res.json(partes);
  } catch (error) {
    console.error('[ERROR] GET /api/partes:', error);
    res.status(500).json({ error: 'Failed to fetch parts from database' });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    console.log('[POST] /api/inventory - Creating in database:', req.body);
    const newItem = await db.createParte(req.body);
    console.log('[POST] /api/inventory - Created in database:', newItem);
    res.json(newItem);
  } catch (error) {
    console.error('[ERROR] POST /api/inventory:', error);
    res.status(500).json({ error: 'Failed to create inventory item in database' });
  }
});

app.post('/api/partes', async (req, res) => {
  try {
    console.log('[POST] /api/partes - Creating in database:', req.body);
    const newItem = await db.createParte(req.body);
    console.log('[POST] /api/partes - Created in database:', newItem);
    res.json(newItem);
  } catch (error) {
    console.error('[ERROR] POST /api/partes:', error);
    res.status(500).json({ error: 'Failed to create part in database' });
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  try {
    console.log(`[PUT] /api/inventory/${req.params.id} - Updating in database:`, req.body);
    const updatedItem = await db.updateParte(req.params.id, req.body);
    console.log(`[PUT] /api/inventory/${req.params.id} - Updated in database:`, updatedItem);
    res.json(updatedItem);
  } catch (error) {
    console.error(`[ERROR] PUT /api/inventory/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update inventory item in database' });
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    console.log(`[DELETE] /api/inventory/${req.params.id} - Deleting from database`);
    await db.deleteParte(req.params.id);
    console.log(`[DELETE] /api/inventory/${req.params.id} - Deleted from database`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[ERROR] DELETE /api/inventory/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete inventory item from database' });
  }
});

// WORK ORDERS ENDPOINTS - USING REAL DATABASE
app.get('/api/work-orders', async (req, res) => {
  try {
    console.log('[GET] /api/work-orders - Fetching from database');
    const orders = await db.getOrders();
    console.log(`[GET] /api/work-orders - Found ${orders.length} work orders from database`);
    res.json(orders);
  } catch (error) {
    console.error('[ERROR] GET /api/work-orders:', error);
    res.status(500).json({ error: 'Failed to fetch work orders from database' });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    console.log('[GET] /api/orders - Fetching from database');
    const orders = await db.getOrders();
    console.log(`[GET] /api/orders - Found ${orders.length} orders from database`);
    res.json(orders);
  } catch (error) {
    console.error('[ERROR] GET /api/orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders from database' });
  }
});

app.post('/api/work-orders', async (req, res) => {
  try {
    console.log('[POST] /api/work-orders - Creating in database:', req.body);
    const newOrder = await db.createOrder(req.body);
    console.log('[POST] /api/work-orders - Created in database:', newOrder);
    res.json(newOrder);
  } catch (error) {
    console.error('[ERROR] POST /api/work-orders:', error);
    res.status(500).json({ error: 'Failed to create work order in database' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    console.log('[POST] /api/orders - Creating in database:', req.body);
    const newOrder = await db.createOrder(req.body);
    console.log('[POST] /api/orders - Created in database:', newOrder);
    res.json(newOrder);
  } catch (error) {
    console.error('[ERROR] POST /api/orders:', error);
    res.status(500).json({ error: 'Failed to create order in database' });
  }
});

// RECEIVE / PENDING PARTS ENDPOINTS - USING REAL DATABASE
app.get('/api/receive', async (req, res) => {
  try {
    console.log('[GET] /api/receive - Fetching from database');
    const pendingParts = await db.getPendingParts();
    console.log(`[GET] /api/receive - Found ${pendingParts.length} pending parts from database`);
    res.json(pendingParts);
  } catch (error) {
    console.error('[ERROR] GET /api/receive:', error);
    res.status(500).json({ error: 'Failed to fetch receive data from database' });
  }
});

app.get('/api/pending-parts', async (req, res) => {
  try {
    console.log('[GET] /api/pending-parts - Fetching from database');
    const pendingParts = await db.getPendingParts();
    console.log(`[GET] /api/pending-parts - Found ${pendingParts.length} pending parts from database`);
    res.json(pendingParts);
  } catch (error) {
    console.error('[ERROR] GET /api/pending-parts:', error);
    res.status(500).json({ error: 'Failed to fetch pending parts from database' });
  }
});

app.get('/api/receive/pending/:trailer', async (req, res) => {
  try {
    console.log(`[GET] /api/receive/pending/${req.params.trailer} - Fetching from database`);
    const pendingParts = await db.getPendingParts();
    const filtered = pendingParts.filter(part => part.trailer === req.params.trailer);
    console.log(`[GET] /api/receive/pending/${req.params.trailer} - Found ${filtered.length} pending parts from database`);
    res.json(filtered);
  } catch (error) {
    console.error(`[ERROR] GET /api/receive/pending/${req.params.trailer}:`, error);
    res.status(500).json({ error: 'Failed to fetch pending parts for trailer from database' });
  }
});

app.get('/api/receive/trailers/with-pending', async (req, res) => {
  try {
    console.log('[GET] /api/receive/trailers/with-pending - Fetching from database');
    const pendingParts = await db.getPendingParts();
    const trailersWithPending = [...new Set(pendingParts.map(part => part.trailer).filter(Boolean))];
    console.log(`[GET] /api/receive/trailers/with-pending - Found ${trailersWithPending.length} trailers from database`);
    res.json(trailersWithPending);
  } catch (error) {
    console.error('[ERROR] GET /api/receive/trailers/with-pending:', error);
    res.status(500).json({ error: 'Failed to fetch trailers with pending parts from database' });
  }
});

// PDF GENERATION
app.post('/api/generate-pdf', (req, res) => {
  console.log('[POST] /api/generate-pdf:', req.body);
  const pdfName = `order_${Date.now()}.pdf`;
  res.json({ success: true, pdfPath: `/pdfs/${pdfName}` });
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
  console.log(`[STARTUP] Minimal server running on port ${PORT}`);
  console.log(`[STARTUP] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[STARTUP] Start time: ${new Date().toISOString()}`);
});
