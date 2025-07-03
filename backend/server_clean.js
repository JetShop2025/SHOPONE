require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

console.log('[STARTUP] Iniciando servidor...');

// CORS EXTREMO - MAXIMA COMPATIBILIDAD
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Max-Age', '86400');
  
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    console.log(`[OPTIONS] Handled for ${req.url}`);
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

console.log('[STARTUP] Middleware configurado');

// ENDPOINTS DE DIAGNOSTICO CRITICO - CON PREFIJO API
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

// BASES DE DATOS Y CONFIGURACION
const db = require('./db');

console.log('[STARTUP] Database module loaded');

// LOGIN ENDPOINT
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('[LOGIN] Request received for user:', username);
    
    // Simple authentication - you can enhance this with proper password hashing
    // For now, accepting a basic hardcoded user or any user from database
    if (username === 'admin' && password === 'admin') {
      console.log('[LOGIN] Admin login successful');
      res.json({ success: true });
      return;
    }
    
    // Try to check if user exists in database
    try {
      const [rows] = await db.execute(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, password]
      );
      
      if (rows.length > 0) {
        console.log('[LOGIN] Database user login successful');
        res.json({ success: true });
      } else {
        console.log('[LOGIN] Invalid credentials');
        res.json({ success: false });
      }
    } catch (dbError) {
      console.log('[LOGIN] Database check failed, using fallback. Error:', dbError.message);
      // Fallback: allow any non-empty username/password for demo purposes
      if (username && password && username.length > 0 && password.length > 0) {
        console.log('[LOGIN] Fallback authentication successful');
        res.json({ success: true });
      } else {
        console.log('[LOGIN] Fallback authentication failed');
        res.json({ success: false });
      }
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

app.put('/api/trailer-locations/:id', async (req, res) => {
  try {
    console.log(`[PUT] /api/trailer-locations/${req.params.id} - Updating location:`, req.body);
    const location = await db.updateTrailerLocation(req.params.id, req.body);
    console.log(`[PUT] /api/trailer-locations/${req.params.id} - Updated location:`, location);
    res.json(location);
  } catch (error) {
    console.error(`[ERROR] PUT /api/trailer-locations/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update trailer location' });
  }
});

app.delete('/api/trailer-locations/:id', async (req, res) => {
  try {
    console.log(`[DELETE] /api/trailer-locations/${req.params.id} - Deleting location`);
    await db.deleteTrailerLocation(req.params.id);
    console.log(`[DELETE] /api/trailer-locations/${req.params.id} - Deleted successfully`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[ERROR] DELETE /api/trailer-locations/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete trailer location' });
  }
});

// ORDERS ENDPOINTS
app.get('/api/orders', async (req, res) => {
  try {
    console.log('[GET] /api/orders - Fetching all orders');
    const orders = await db.getOrders();
    console.log(`[GET] /api/orders - Found ${orders.length} orders`);
    res.json(orders);
  } catch (error) {
    console.error('[ERROR] GET /api/orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    console.log('[POST] /api/orders - Creating order:', req.body);
    const order = await db.createOrder(req.body);
    console.log('[POST] /api/orders - Created order:', order);
    res.json(order);
  } catch (error) {
    console.error('[ERROR] POST /api/orders:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PARTS ENDPOINTS
app.get('/api/partes', async (req, res) => {
  try {
    console.log('[GET] /api/partes - Fetching all parts');
    const partes = await db.getPartes();
    console.log(`[GET] /api/partes - Found ${partes.length} parts`);
    res.json(partes);
  } catch (error) {
    console.error('[ERROR] GET /api/partes:', error);
    res.status(500).json({ error: 'Failed to fetch parts' });
  }
});

app.post('/api/partes', async (req, res) => {
  try {
    console.log('[POST] /api/partes - Creating part:', req.body);
    const parte = await db.createParte(req.body);
    console.log('[POST] /api/partes - Created part:', parte);
    res.json(parte);
  } catch (error) {
    console.error('[ERROR] POST /api/partes:', error);
    res.status(500).json({ error: 'Failed to create part' });
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
