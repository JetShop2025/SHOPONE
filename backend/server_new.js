const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

console.log('[STARTUP] Starting minimal server...');

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

// Mock data
const mockData = {
  trailers: [
    { id: 1, numero: 'T001', type: 'DRY VAN', modelo: 'FREIGHTLINER', año: '2020', placa: 'ABC123', status: 'ACTIVO' },
    { id: 2, numero: 'T002', type: 'REEFER', modelo: 'VOLVO', año: '2021', placa: 'DEF456', status: 'MANTENIMIENTO' }
  ],
  trailerLocations: [
    { id: 1, trailer: 'T001', location: 'Miami, FL', fecha: '2025-01-07', status: 'EN RUTA' },
    { id: 2, trailer: 'T002', location: 'Atlanta, GA', fecha: '2025-01-07', status: 'CARGANDO' }
  ],
  inventory: [
    { id: 1, codigo: 'P001', descripcion: 'Brake Pads', categoria: 'FRENOS', cantidad: 50, precio: 125.00 },
    { id: 2, codigo: 'P002', descripcion: 'Air Filter', categoria: 'FILTROS', cantidad: 30, precio: 45.00 }
  ],
  orders: [
    { id: 1, numero: 'WO001', trailer: 'T001', fecha: '2025-01-07', status: 'ABIERTA', descripcion: 'Brake maintenance' },
    { id: 2, numero: 'WO002', trailer: 'T002', fecha: '2025-01-07', status: 'EN_PROGRESO', descripcion: 'Engine check' }
  ],
  pendingParts: [
    { id: 1, parte: 'P001', trailer: 'T001', cantidad: 5, status: 'PENDIENTE' },
    { id: 2, parte: 'P002', trailer: 'T002', cantidad: 2, status: 'PENDIENTE' }
  ]
};

// DIAGNOSTIC ENDPOINTS
app.get('/api/status', (req, res) => {
  console.log('[STATUS] Request received');
  res.json({ 
    status: 'Server is running',
    message: 'GraphicalSystem Backend Minimal v1.0',
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

// TRAILERS ENDPOINTS
app.get('/api/trailers', (req, res) => {
  console.log('[GET] /api/trailers');
  res.json(mockData.trailers);
});

app.get('/api/trailas', (req, res) => {
  console.log('[GET] /api/trailas (alias for trailers)');
  res.json(mockData.trailers);
});

app.post('/api/trailers', (req, res) => {
  console.log('[POST] /api/trailers:', req.body);
  const newTrailer = { id: Date.now(), ...req.body };
  mockData.trailers.push(newTrailer);
  res.json(newTrailer);
});

app.post('/api/trailas', (req, res) => {
  console.log('[POST] /api/trailas:', req.body);
  const newTrailer = { id: Date.now(), ...req.body };
  mockData.trailers.push(newTrailer);
  res.json(newTrailer);
});

app.put('/api/trailers/:id', (req, res) => {
  console.log(`[PUT] /api/trailers/${req.params.id}:`, req.body);
  const index = mockData.trailers.findIndex(t => t.id == req.params.id);
  if (index !== -1) {
    mockData.trailers[index] = { ...mockData.trailers[index], ...req.body };
    res.json(mockData.trailers[index]);
  } else {
    res.status(404).json({ error: 'Trailer not found' });
  }
});

app.put('/api/trailas/:id', (req, res) => {
  console.log(`[PUT] /api/trailas/${req.params.id}:`, req.body);
  const index = mockData.trailers.findIndex(t => t.id == req.params.id);
  if (index !== -1) {
    mockData.trailers[index] = { ...mockData.trailers[index], ...req.body };
    res.json(mockData.trailers[index]);
  } else {
    res.status(404).json({ error: 'Trailer not found' });
  }
});

app.delete('/api/trailers/:id', (req, res) => {
  console.log(`[DELETE] /api/trailers/${req.params.id}`);
  const index = mockData.trailers.findIndex(t => t.id == req.params.id);
  if (index !== -1) {
    mockData.trailers.splice(index, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Trailer not found' });
  }
});

app.delete('/api/trailas/:id', (req, res) => {
  console.log(`[DELETE] /api/trailas/${req.params.id}`);
  const index = mockData.trailers.findIndex(t => t.id == req.params.id);
  if (index !== -1) {
    mockData.trailers.splice(index, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Trailer not found' });
  }
});

// TRAILER LOCATIONS ENDPOINTS
app.get('/api/trailer-locations', (req, res) => {
  console.log('[GET] /api/trailer-locations');
  res.json(mockData.trailerLocations);
});

app.post('/api/trailer-locations', (req, res) => {
  console.log('[POST] /api/trailer-locations:', req.body);
  const newLocation = { id: Date.now(), ...req.body };
  mockData.trailerLocations.push(newLocation);
  res.json(newLocation);
});

app.put('/api/trailer-locations/:id', (req, res) => {
  console.log(`[PUT] /api/trailer-locations/${req.params.id}:`, req.body);
  const index = mockData.trailerLocations.findIndex(l => l.id == req.params.id);
  if (index !== -1) {
    mockData.trailerLocations[index] = { ...mockData.trailerLocations[index], ...req.body };
    res.json(mockData.trailerLocations[index]);
  } else {
    res.status(404).json({ error: 'Location not found' });
  }
});

app.delete('/api/trailer-locations/:id', (req, res) => {
  console.log(`[DELETE] /api/trailer-locations/${req.params.id}`);
  const index = mockData.trailerLocations.findIndex(l => l.id == req.params.id);
  if (index !== -1) {
    mockData.trailerLocations.splice(index, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Location not found' });
  }
});

// INVENTORY ENDPOINTS
app.get('/api/inventory', (req, res) => {
  console.log('[GET] /api/inventory');
  res.json(mockData.inventory);
});

app.get('/api/partes', (req, res) => {
  console.log('[GET] /api/partes (alias for inventory)');
  res.json(mockData.inventory);
});

app.post('/api/inventory', (req, res) => {
  console.log('[POST] /api/inventory:', req.body);
  const newItem = { id: Date.now(), ...req.body };
  mockData.inventory.push(newItem);
  res.json(newItem);
});

app.post('/api/partes', (req, res) => {
  console.log('[POST] /api/partes:', req.body);
  const newItem = { id: Date.now(), ...req.body };
  mockData.inventory.push(newItem);
  res.json(newItem);
});

app.put('/api/inventory/:id', (req, res) => {
  console.log(`[PUT] /api/inventory/${req.params.id}:`, req.body);
  const index = mockData.inventory.findIndex(i => i.id == req.params.id);
  if (index !== -1) {
    mockData.inventory[index] = { ...mockData.inventory[index], ...req.body };
    res.json(mockData.inventory[index]);
  } else {
    res.status(404).json({ error: 'Item not found' });
  }
});

app.delete('/api/inventory/:id', (req, res) => {
  console.log(`[DELETE] /api/inventory/${req.params.id}`);
  const index = mockData.inventory.findIndex(i => i.id == req.params.id);
  if (index !== -1) {
    mockData.inventory.splice(index, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Item not found' });
  }
});

// WORK ORDERS ENDPOINTS
app.get('/api/work-orders', (req, res) => {
  console.log('[GET] /api/work-orders');
  res.json(mockData.orders);
});

app.get('/api/orders', (req, res) => {
  console.log('[GET] /api/orders (alias for work-orders)');
  res.json(mockData.orders);
});

app.post('/api/work-orders', (req, res) => {
  console.log('[POST] /api/work-orders:', req.body);
  const newOrder = { id: Date.now(), ...req.body };
  mockData.orders.push(newOrder);
  res.json(newOrder);
});

app.post('/api/orders', (req, res) => {
  console.log('[POST] /api/orders:', req.body);
  const newOrder = { id: Date.now(), ...req.body };
  mockData.orders.push(newOrder);
  res.json(newOrder);
});

// RECEIVE / PENDING PARTS ENDPOINTS
app.get('/api/receive', (req, res) => {
  console.log('[GET] /api/receive');
  res.json(mockData.pendingParts);
});

app.get('/api/pending-parts', (req, res) => {
  console.log('[GET] /api/pending-parts');
  res.json(mockData.pendingParts);
});

app.get('/api/receive/pending/:trailer', (req, res) => {
  console.log(`[GET] /api/receive/pending/${req.params.trailer}`);
  const filtered = mockData.pendingParts.filter(part => part.trailer === req.params.trailer);
  res.json(filtered);
});

app.get('/api/receive/trailers/with-pending', (req, res) => {
  console.log('[GET] /api/receive/trailers/with-pending');
  const trailersWithPending = [...new Set(mockData.pendingParts.map(part => part.trailer).filter(Boolean))];
  res.json(trailersWithPending);
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
