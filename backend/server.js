// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const upload = multer();

const app = express();

console.log('[STARTUP] Starting server with database connection...');
console.log('[ENV] Database config:', {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT
});

// Import database functions
const db = require('./db');

// Import connection directly for some operations  
const mysql = require('mysql2/promise');
const connection = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  database: process.env.MYSQL_DATABASE,
  password: process.env.MYSQL_PASSWORD,
  port: process.env.MYSQL_PORT,
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000
});

// Import route modules
const auditRoutes = require('./routes/audit');

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

// AUDIT ROUTES
app.use('/api/audit', auditRoutes);

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

// LOGIN ENDPOINT - USANDO BASE DE DATOS
app.post('/api/login', async (req, res) => {
  console.log('[LOGIN] Login attempt:', req.body);
  const { username, password } = req.body;
  
  try {
    // Consultar usuarios en la base de datos
    const users = await db.getUsers();
    console.log('[LOGIN] Checking against database users...');
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      console.log('[LOGIN] User authenticated:', user.username);
      res.json({ 
        success: true, 
        token: `token-${user.id}-${Date.now()}`,
        user: { 
          username: user.username, 
          role: user.role || 'user',
          id: user.id 
        }
      });
    } else {
      console.log('[LOGIN] Invalid credentials for:', username);
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('[LOGIN] Database error:', error);
    res.status(500).json({ success: false, error: 'Database error' });
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
    const usuario = req.body.usuario || 'SYSTEM';
    const newTrailer = await db.createTrailer(req.body, usuario);
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
    const usuario = req.body.usuario || 'SYSTEM';
    const newTrailer = await db.createTrailer(req.body, usuario);
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
    const usuario = req.body.usuario || 'SYSTEM';
    const updatedTrailer = await db.updateTrailer(req.params.id, req.body, usuario);
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
    const usuario = req.body.usuario || 'SYSTEM';
    const updatedTrailer = await db.updateTrailer(req.params.id, req.body, usuario);
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
    const usuario = req.body.usuario || 'SYSTEM';
    await db.deleteTrailer(req.params.id, usuario);
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
    const usuario = req.body.usuario || 'SYSTEM';
    await db.deleteTrailer(req.params.id, usuario);
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

// INVENTORY ENDPOINTS - USING REAL DATABASE (Optimizado para memoria)
app.get('/api/inventory', async (req, res) => {
  try {
    console.log('[GET] /api/inventory - Fetching from database');
    const limit = parseInt(req.query.limit) || 200;
    const offset = parseInt(req.query.offset) || 0;
    const partes = await db.getPartes(limit, offset);
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
    const limit = parseInt(req.query.limit) || 200;
    const offset = parseInt(req.query.offset) || 0;
    const partes = await db.getPartes(limit, offset);
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
    const usuario = req.body.usuario || 'SYSTEM';
    const newItem = await db.createParte(req.body, usuario);
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
    const usuario = req.body.usuario || 'SYSTEM';
    const newItem = await db.createParte(req.body, usuario);
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
    const usuario = req.body.usuario || 'SYSTEM';
    const updatedItem = await db.updateParte(req.params.id, req.body, usuario);
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
    const usuario = req.body.usuario || 'SYSTEM';
    await db.deleteParte(req.params.id, usuario);
    console.log(`[DELETE] /api/inventory/${req.params.id} - Deleted from database`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[ERROR] DELETE /api/inventory/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete inventory item from database' });
  }
});

// WORK ORDERS ENDPOINTS - USING REAL DATABASE (Optimizado con paginación inteligente)
app.get('/api/work-orders', async (req, res) => {
  try {
    console.log('[GET] /api/work-orders - Fetching from database');
    
    // Parámetros de paginación
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 1000; // 1000 registros por página por defecto
    const searchIdClassic = req.query.searchIdClassic || '';
    const includeArchived = req.query.includeArchived === 'true';
    
    // Si hay búsqueda específica por ID Classic, buscar en toda la base de datos
    if (searchIdClassic) {
      console.log(`[GET] /api/work-orders - Searching for ID Classic: ${searchIdClassic}`);
      const [searchResults] = await db.connection.execute(
        `SELECT * FROM work_orders 
         WHERE idClassic LIKE ? OR id = ?
         ORDER BY id DESC`,
        [`%${searchIdClassic}%`, searchIdClassic]
      );
      
      const parsedResults = searchResults.map(order => {
        let parts = [], mechanics = [], extraOptions = [];
        try { parts = JSON.parse(order.parts || '[]'); } catch (e) { parts = []; }
        try { mechanics = JSON.parse(order.mechanics || '[]'); } catch (e) { mechanics = []; }
        try { extraOptions = JSON.parse(order.extraOptions || '[]'); } catch (e) { extraOptions = []; }
        return { ...order, parts, mechanics, extraOptions };
      });
      
      console.log(`[GET] /api/work-orders - Found ${parsedResults.length} work orders matching search`);
      return res.json(parsedResults);
    }
    
    // Carga normal con paginación
    const offset = (page - 1) * pageSize;
    let query = `SELECT * FROM work_orders`;
    let whereClause = '';
    
    // Si no incluir archivadas, filtrar por fecha (últimos 2 años por defecto)
    if (!includeArchived) {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      whereClause = ` WHERE date >= '${twoYearsAgo.toISOString().split('T')[0]}'`;
    }
    
    query += whereClause + ` ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset}`;
    
    console.log(`[GET] /api/work-orders - Executing query: ${query}`);
    const [results] = await db.connection.execute(query);
    
    // Contar total de registros para paginación
    const countQuery = `SELECT COUNT(*) as total FROM work_orders${whereClause}`;
    const [countResult] = await db.connection.execute(countQuery);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / pageSize);
    
    const parsedResults = results.map(order => {
      let parts = [], mechanics = [], extraOptions = [];
      try { parts = JSON.parse(order.parts || '[]'); } catch (e) { parts = []; }
      try { mechanics = JSON.parse(order.mechanics || '[]'); } catch (e) { mechanics = []; }
      try { extraOptions = JSON.parse(order.extraOptions || '[]'); } catch (e) { extraOptions = []; }
      return { ...order, parts, mechanics, extraOptions };
    });
    
    console.log(`[GET] /api/work-orders - Found ${parsedResults.length} work orders (Page ${page}/${totalPages}, Total: ${totalRecords})`);
    
    res.json({
      data: parsedResults,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalRecords: totalRecords,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    console.error('[ERROR] GET /api/work-orders:', error);
    res.status(500).json({ error: 'Failed to fetch work orders from database' });
  }
});

// Get work orders by trailer
app.get('/api/work-orders/trailer/:trailerId', async (req, res) => {
  try {
    console.log('[GET] /api/work-orders/trailer/:trailerId - Fetching from database:', req.params.trailerId);
    const orders = await db.getOrdersByTrailer(req.params.trailerId);
    console.log(`[GET] /api/work-orders/trailer/:trailerId - Found ${orders.length} work orders for trailer ${req.params.trailerId}`);
    res.json(orders);  } catch (error) {
    console.error('[ERROR] GET /api/work-orders/trailer/:trailerId:', error);
    res.status(500).json({ error: 'Failed to fetch work orders for trailer from database' });
  }
});

// Get single work order by ID
app.get('/api/work-orders/:id', async (req, res) => {
  try {
    console.log('[GET] /api/work-orders/:id - Fetching from database:', req.params.id);
    const order = await db.getOrderById(req.params.id);
    if (!order) {
      console.log('[GET] /api/work-orders/:id - Work order not found:', req.params.id);
      return res.status(404).json({ error: 'Work order not found' });
    }
    console.log('[GET] /api/work-orders/:id - Found work order:', order);
    res.json(order);
  } catch (error) {
    console.error('[ERROR] GET /api/work-orders/:id:', error);
    res.status(500).json({ error: 'Failed to fetch work order from database' });
  }
});

// Get work order parts by work order ID
app.get('/api/work-order-parts/:id', async (req, res) => {
  try {
    console.log('[GET] /api/work-order-parts/:id - Fetching from database:', req.params.id);
    const parts = await db.getWorkOrderParts(req.params.id);
    console.log(`[GET] /api/work-order-parts/:id - Found ${parts.length} parts for work order ${req.params.id}`);
    res.json(parts);
  } catch (error) {
    console.error('[ERROR] GET /api/work-order-parts/:id:', error);
    res.status(500).json({ error: 'Failed to fetch work order parts from database' });
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

app.put('/api/work-orders/:id', async (req, res) => {
  try {
    console.log('[PUT] /api/work-orders/:id - Updating in database:', req.params.id, req.body);
    const updatedOrder = await db.updateOrder(req.params.id, req.body);
    console.log('[PUT] /api/work-orders/:id - Updated in database:', updatedOrder);
    res.json(updatedOrder);
  } catch (error) {
    console.error('[ERROR] PUT /api/work-orders/:id:', error);
    res.status(500).json({ error: 'Failed to update work order in database' });
  }
});

app.delete('/api/work-orders/:id', async (req, res) => {
  try {
    console.log('[DELETE] /api/work-orders/:id - Deleting from database:', req.params.id);
    const result = await db.deleteOrder(req.params.id);
    console.log('[DELETE] /api/work-orders/:id - Deleted from database:', result);
    res.json(result);
  } catch (error) {
    console.error('[ERROR] DELETE /api/work-orders/:id:', error);
    res.status(500).json({ error: 'Failed to delete work order from database' });
  }
});

// Get rental history for a trailer
app.get('/api/trailas/:trailerName/rental-history', async (req, res) => {
  try {
    console.log('[GET] /api/trailas/:trailerName/rental-history - Fetching from database:', req.params.trailerName);
    
    // Buscar historial de rentas por número de trailer
    const [history] = await connection.execute(`
      SELECT * FROM trailer_rental_history 
      WHERE trailer_numero = ? 
      ORDER BY created_at DESC
    `, [req.params.trailerName]);
    
    console.log(`[GET] /api/trailas/:trailerName/rental-history - Found ${history.length} rental records for trailer ${req.params.trailerName}`);
    res.json(history);
  } catch (error) {
    console.error('[ERROR] GET /api/trailas/:trailerName/rental-history:', error);
    
    // Si la tabla no existe, devolveremos un array vacío pero intentaremos crearla
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS trailer_rental_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          trailer_id INT NOT NULL,
          trailer_numero VARCHAR(50),
          cliente VARCHAR(255),
          fecha_renta DATE,
          fecha_devolucion_estimada DATE,
          fecha_devolucion_real DATE NULL,
          observaciones TEXT,
          status VARCHAR(50) DEFAULT 'ACTIVE',
          usuario VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('[INFO] Created trailer_rental_history table');
      res.json([]);
    } catch (createError) {
      console.error('[ERROR] Failed to create trailer_rental_history table:', createError);
      res.status(500).json({ error: 'Failed to fetch rental history from database' });
    }
  }
});

// Trailer rental endpoint
app.put('/api/trailas/:id/rent', async (req, res) => {
  try {
    const trailerId = req.params.id;
    const { cliente, fecha_renta, fecha_devolucion, observaciones } = req.body;
    const usuario = req.body.usuario || 'SYSTEM';
    
    console.log(`[PUT] /api/trailas/${trailerId}/rent - Renting trailer:`, req.body);
    
    // Primero verificar qué columnas existen en la tabla trailers
    const [columns] = await connection.execute('DESCRIBE trailers');
    console.log('[DEBUG] Trailers table columns:', columns.map(col => col.Field));
    
    // Obtener datos actuales del trailer para auditoría
    const [current] = await connection.execute('SELECT * FROM trailers WHERE id = ?', [trailerId]);
    const oldData = current[0] || null;
    
    if (!oldData) {
      return res.status(404).json({ error: 'Trailer not found' });
    }
      // Verificar si existe la columna status o estatus
    const hasStatusColumn = columns.some(col => col.Field === 'status');
    const hasEstatusColumn = columns.some(col => col.Field === 'estatus');
    const hasObservacionesColumn = columns.some(col => col.Field === 'observaciones');
    
    let updateQuery = 'UPDATE trailers SET ';
    let updateValues = [];
    let updateFields = [];
    
    // Solo actualizar columnas que existen - priorizar 'estatus' sobre 'status'
    if (hasEstatusColumn) {
      updateFields.push('estatus = ?');
      updateValues.push('RENTADO');
      console.log('[INFO] Using estatus column for status update');
    } else if (hasStatusColumn) {
      updateFields.push('status = ?');
      updateValues.push('RENTADO');
      console.log('[INFO] Using status column for status update');
    } else {
      console.log('[WARNING] No status/estatus column found!');
    }
    
    if (hasObservacionesColumn) {
      updateFields.push('observaciones = ?');
      updateValues.push(`Cliente: ${cliente} | Renta: ${fecha_renta} | Devolución: ${fecha_devolucion} | Obs: ${observaciones}`);
    } else {
      // Si no existe observaciones, usar otra columna disponible o crear registro en tabla separada
      console.log('[INFO] No observaciones column found, storing rental info in audit trail');
    }
    
    if (updateFields.length > 0) {
      updateQuery += updateFields.join(', ') + ' WHERE id = ?';
      updateValues.push(trailerId);
      
      await connection.execute(updateQuery, updateValues);
    }
    
    // Crear registro en tabla de historial de rentas (la crearemos si no existe)
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS trailer_rental_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          trailer_id INT NOT NULL,
          trailer_numero VARCHAR(50),
          cliente VARCHAR(255),
          fecha_renta DATE,
          fecha_devolucion_estimada DATE,
          fecha_devolucion_real DATE NULL,
          observaciones TEXT,
          status VARCHAR(50) DEFAULT 'ACTIVE',
          usuario VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      
      // Insertar registro de renta
      await connection.execute(`
        INSERT INTO trailer_rental_history 
        (trailer_id, trailer_numero, cliente, fecha_renta, fecha_devolucion_estimada, observaciones, status, usuario)
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
      `, [trailerId, oldData.numero, cliente, fecha_renta, fecha_devolucion, observaciones, usuario]);
      
      console.log(`[PUT] /api/trailas/${trailerId}/rent - Rental history record created`);
    } catch (historyError) {
      console.error('[ERROR] Creating rental history:', historyError);
      // No fallar la operación principal por esto
    }
    
    // Obtener datos actualizados
    const [updated] = await connection.execute('SELECT * FROM trailers WHERE id = ?', [trailerId]);
    const newData = updated[0] || null;
    
    console.log(`[PUT] /api/trailas/${trailerId}/rent - Trailer rented successfully`);
    res.json({ 
      success: true, 
      trailer: newData, 
      rental_info: { cliente, fecha_renta, fecha_devolucion, observaciones },
      message: 'Trailer rented successfully and history recorded'
    });
  } catch (error) {
    console.error(`[ERROR] PUT /api/trailas/${req.params.id}/rent:`, error);
    res.status(500).json({ error: 'Failed to rent trailer', details: error.message });
  }
});

// Trailer return endpoint
app.put('/api/trailas/:id/return', async (req, res) => {
  try {
    const trailerId = req.params.id;
    const { fecha_devolucion_real, observaciones_devolucion } = req.body;
    const usuario = req.body.usuario || 'SYSTEM';
    
    console.log(`[PUT] /api/trailas/${trailerId}/return - Returning trailer`, req.body);
      // Verificar columnas disponibles
    const [columns] = await connection.execute('DESCRIBE trailers');
    const hasStatusColumn = columns.some(col => col.Field === 'status');
    const hasEstatusColumn = columns.some(col => col.Field === 'estatus');
    const hasObservacionesColumn = columns.some(col => col.Field === 'observaciones');
    
    // Obtener datos actuales del trailer
    const [current] = await connection.execute('SELECT * FROM trailers WHERE id = ?', [trailerId]);
    const oldData = current[0] || null;
    
    if (!oldData) {
      return res.status(404).json({ error: 'Trailer not found' });
    }
    
    const fechaDevolucionReal = fecha_devolucion_real || new Date().toISOString().split('T')[0];
    
    // Actualizar trailer como disponible
    let updateQuery = 'UPDATE trailers SET ';
    let updateValues = [];
    let updateFields = [];
    
    // Priorizar 'estatus' sobre 'status'
    if (hasEstatusColumn) {
      updateFields.push('estatus = ?');
      updateValues.push('DISPONIBLE');
      console.log('[INFO] Using estatus column for status update (DISPONIBLE)');
    } else if (hasStatusColumn) {
      updateFields.push('status = ?');
      updateValues.push('DISPONIBLE');
      console.log('[INFO] Using status column for status update (DISPONIBLE)');
    } else {
      console.log('[WARNING] No status/estatus column found!');
    }
    
    if (hasObservacionesColumn) {
      updateFields.push('observaciones = ?');
      updateValues.push(`Devuelto el ${fechaDevolucionReal}${observaciones_devolucion ? ' - ' + observaciones_devolucion : ''}`);
    }
    
    if (updateFields.length > 0) {
      updateQuery += updateFields.join(', ') + ' WHERE id = ?';
      updateValues.push(trailerId);
      
      await connection.execute(updateQuery, updateValues);
    }
    
    // Actualizar registro activo en historial de rentas
    try {
      await connection.execute(`
        UPDATE trailer_rental_history 
        SET fecha_devolucion_real = ?, status = 'RETURNED', 
            observaciones = CONCAT(COALESCE(observaciones, ''), ' | Devuelto: ', ?)
        WHERE trailer_id = ? AND status = 'ACTIVE'
        ORDER BY created_at DESC LIMIT 1
      `, [fechaDevolucionReal, observaciones_devolucion || 'Sin observaciones', trailerId]);
      
      console.log(`[PUT] /api/trailas/${trailerId}/return - Rental history updated`);
    } catch (historyError) {
      console.error('[ERROR] Updating rental history:', historyError);
    }
    
    // Obtener datos actualizados
    const [updated] = await connection.execute('SELECT * FROM trailers WHERE id = ?', [trailerId]);
    const newData = updated[0] || null;
      
    console.log(`[PUT] /api/trailas/${trailerId}/return - Trailer returned successfully`);
    res.json({ 
      success: true, 
      trailer: newData, 
      return_info: { fecha_devolucion_real: fechaDevolucionReal, observaciones_devolucion },
      message: 'Trailer returned successfully and history updated'
    });
  } catch (error) {
    console.error(`[ERROR] PUT /api/trailas/${req.params.id}/return:`, error);
    res.status(500).json({ error: 'Failed to return trailer', details: error.message });
  }
});

app.post('/api/work-order-parts', async (req, res) => {
  try {
    console.log('[POST] /api/work-order-parts - Creating in database:', req.body);
    const newWorkOrderPart = await db.createWorkOrderPart(req.body, req.body.fifo_info);
    console.log('[POST] /api/work-order-parts - Created in database:', newWorkOrderPart);
    res.json(newWorkOrderPart);
  } catch (error) {
    console.error('[ERROR] POST /api/work-order-parts:', error);
    res.status(500).json({ error: 'Failed to create work order part in database' });
  }
});

// PUT endpoint para actualizar work order parts
app.put('/api/work-order-parts/:id', async (req, res) => {
  try {
    console.log('[PUT] /api/work-order-parts/:id - Updating in database:', req.params.id, req.body);
    const updatedWorkOrderPart = await db.updateWorkOrderPart(req.params.id, req.body);
    console.log('[PUT] /api/work-order-parts/:id - Updated in database:', updatedWorkOrderPart);
    res.json(updatedWorkOrderPart);
  } catch (error) {
    console.error('[ERROR] PUT /api/work-order-parts/:id:', error);
    res.status(500).json({ error: 'Failed to update work order part in database' });
  }
});

app.post('/api/inventory/deduct', async (req, res) => {
  try {
    console.log('[POST] /api/inventory/deduct - Deducting inventory:', req.body);
    const result = await db.deductInventory(req.body.parts || []);
    console.log('[POST] /api/inventory/deduct - Successfully deducted inventory:', result);
    res.json(result);
  } catch (error) {
    console.error('[ERROR] POST /api/inventory/deduct:', error);
    res.status(500).json({ error: 'Failed to deduct inventory in database' });
  }
});

app.post('/api/inventory/deduct-fifo', async (req, res) => {
  try {
    console.log('[POST] /api/inventory/deduct-fifo - Deducting inventory with FIFO:', req.body);
    const usuario = req.body.usuario || 'unknown';
    const result = await db.deductInventoryFIFO(req.body.parts || [], usuario);
    console.log('[POST] /api/inventory/deduct-fifo - Successfully deducted inventory with FIFO:', result);
    res.json(result);
  } catch (error) {
    console.error('[ERROR] POST /api/inventory/deduct-fifo:', error);
    res.status(500).json({ error: 'Failed to deduct inventory with FIFO in database' });
  }
});

// RECEIVE / PENDING PARTS ENDPOINTS - USING REAL DATABASE
app.get('/api/receive', async (req, res) => {
  try {
    console.log('[GET] /api/receive - Fetching ALL parts from database');
    const receivesParts = await db.getReceivesParts();
    console.log(`[GET] /api/receive - Found ${receivesParts.length} total parts from database`);
    res.json(receivesParts);
  } catch (error) {
    console.error('[ERROR] GET /api/receive:', error);
    res.status(500).json({ error: 'Failed to fetch receive data from database' });
  }
});

app.post('/api/receive', async (req, res) => {
  try {
    console.log('[POST] /api/receive - Creating pending part in database:', req.body);
    const newPendingPart = await db.createPendingPart(req.body);
    console.log('[POST] /api/receive - Created pending part in database:', newPendingPart);
    res.json(newPendingPart);
  } catch (error) {
    console.error('[ERROR] POST /api/receive:', error);
    res.status(500).json({ error: 'Failed to create pending part in database' });
  }
});

app.put('/api/receive/:id', async (req, res) => {
  try {
    console.log(`[PUT] /api/receive/${req.params.id} - Updating in database:`, req.body);
    const updatedPart = await db.updatePendingPart(req.params.id, req.body);
    console.log(`[PUT] /api/receive/${req.params.id} - Updated in database:`, updatedPart);
    res.json(updatedPart);
  } catch (error) {
    console.error(`[ERROR] PUT /api/receive/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update pending part in database' });
  }
});

app.put('/api/receive/:id/mark-used', async (req, res) => {
  try {
    console.log(`[PUT] /api/receive/${req.params.id}/mark-used - Marking as USED:`, req.body);
    const updatedPart = await db.updatePendingPart(req.params.id, { 
      ...req.body, 
      estatus: 'USED',
      usuario: req.body.usuario || ''
    });
    console.log(`[PUT] /api/receive/${req.params.id}/mark-used - Marked as USED:`, updatedPart);
    res.json(updatedPart);
  } catch (error) {
    console.error(`[ERROR] PUT /api/receive/${req.params.id}/mark-used:`, error);
    res.status(500).json({ error: 'Failed to mark pending part as used' });
  }
});

app.delete('/api/receive/:id', async (req, res) => {
  try {
    console.log(`[DELETE] /api/receive/${req.params.id} - Deleting from database`);
    await db.deletePendingPart(req.params.id);
    console.log(`[DELETE] /api/receive/${req.params.id} - Deleted from database`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[ERROR] DELETE /api/receive/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete pending part from database' });
  }
});

app.get('/api/receive/pending/:trailer', async (req, res) => {
  try {
    console.log(`[GET] /api/receive/pending/${req.params.trailer} - Fetching from database`);
    
    // Obtener todas las partes de receives
    const allParts = await db.getReceivesParts();
    
    // Filtrar por trailer y estado PENDING (simplificado - ya no necesitamos calcular uso)
    const filtered = allParts
      .filter(part => {
        const isCorrectTrailer = part.destino_trailer === req.params.trailer;
        const isPending = part.estatus === 'PENDING';
        const hasQty = Number(part.qty || 0) > 0;
        
        console.log(`[PENDING_CHECK] ${part.sku} for ${req.params.trailer}: 
          Status=${part.estatus}, Qty=${part.qty}, Match=${isCorrectTrailer && isPending && hasQty}`);
        
        return isCorrectTrailer && isPending && hasQty;
      });
    
    console.log(`[GET] /api/receive/pending/${req.params.trailer} - Found ${filtered.length} pending parts`);
    res.json(filtered);
  } catch (error) {
    console.error(`[ERROR] GET /api/receive/pending/${req.params.trailer}:`, error);
    res.status(500).json({ error: 'Failed to fetch pending parts for trailer from database' });
  }
});

app.get('/api/receive/trailers/with-pending', async (req, res) => {
  try {
    console.log('[GET] /api/receive/trailers/with-pending - Fetching from database with simple filtering');
    
    // Obtener todas las partes de receives
    const allParts = await db.getReceivesParts();
    
    // Solo trailers que tengan partes PENDING con qty > 0
    const trailersWithPending = [...new Set(
      allParts
        .filter(part => {
          // Solo PENDING con cantidad disponible
          const isPending = part.estatus === 'PENDING';
          const hasQty = Number(part.qty || 0) > 0;
          const hasTrailer = Boolean(part.destino_trailer);
          
          console.log(`[CHECK] ${part.sku} -> ${part.destino_trailer}: PENDING=${isPending}, QTY=${part.qty}, RESULT=${isPending && hasQty && hasTrailer}`);
          return isPending && hasQty && hasTrailer;
        })
        .map(part => part.destino_trailer)
        .filter(Boolean)
    )];
    
    console.log(`[GET] /api/receive/trailers/with-pending - Found ${trailersWithPending.length} trailers with pending parts (simple logic)`);
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

app.post('/api/work-orders/:id/generate-pdf', (req, res) => {
  console.log(`[POST] /api/work-orders/${req.params.id}/generate-pdf:`, req.body);
  const pdfName = `work_order_${req.params.id}_${Date.now()}.pdf`;
  res.json({ success: true, pdfPath: `/pdfs/${pdfName}` });
});

app.post('/api/work-orders/:id/pdf', upload.single('pdf'), async (req, res) => {
  try {
    console.log('[POST] /api/work-orders/:id/pdf - Saving PDF to database:', req.params.id);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }
    
    const workOrderId = req.params.id;
    const pdfBuffer = req.file.buffer;
    
    // Guardar PDF en la base de datos
    const result = await db.savePDFToWorkOrder(workOrderId, pdfBuffer);
    console.log('[POST] /api/work-orders/:id/pdf - PDF saved to database:', result);
    
    res.json({ success: true, message: 'PDF saved successfully' });
  } catch (error) {
    console.error('[ERROR] POST /api/work-orders/:id/pdf:', error);
    res.status(500).json({ error: 'Failed to save PDF to database' });
  }
});

// Serve assets (logo) - DEBE IR ANTES DEL CATCH-ALL
app.get('/api/assets/logo.png', (req, res) => {
  console.log('[ASSETS] Serving logo.png');
  const logoPath = path.join(__dirname, 'assets', 'logo.png');
  res.sendFile(logoPath, (err) => {
    if (err) {
      console.error('[ASSETS] Error serving logo:', err);
      res.status(404).json({ error: 'Logo not found' });
    }
  });
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

// ENHANCED KEEP-ALIVE ENDPOINTS
app.get('/api/ping', (req, res) => {
  console.log('[PING] Keep-alive ping received');
  res.json({ 
    status: 'pong',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.get('/api/wake', (req, res) => {
  console.log('[WAKE] Wake-up call received');
  res.json({ 
    status: 'awake',
    message: 'Server is awake and running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[STARTUP] Minimal server running on port ${PORT}`);
  console.log(`[STARTUP] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[STARTUP] Start time: ${new Date().toISOString()}`);
});
