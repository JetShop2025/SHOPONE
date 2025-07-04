// Load environment variables
require('dotenv').config();

const mysql = require('mysql2/promise');

console.log('[DB] Creating database connection with:', {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT
});

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

// Test database connection
async function testConnection() {
  try {
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('[DB] Database connection successful');
    return true;
  } catch (error) {
    console.error('[DB] Database connection failed:', error.message);
    return false;
  }
}

// Call test connection on startup
testConnection();

// Trailers functions
async function getTrailers() {
  try {
    const [rows] = await connection.execute('SELECT * FROM trailers');
    return rows;
  } catch (error) {
    console.error('[DB] Error getting trailers:', error.message);
    throw error;
  }
}

async function createTrailer(trailer) {
  try {
    const [result] = await connection.execute(
      'INSERT INTO trailers (numero, type, modelo, año, placa, status) VALUES (?, ?, ?, ?, ?, ?)',
      [trailer.numero, trailer.type, trailer.modelo, trailer.año, trailer.placa, trailer.status]
    );
    return { id: result.insertId, ...trailer };
  } catch (error) {
    console.error('[DB] Error creating trailer:', error.message);
    throw error;
  }
}

async function updateTrailer(id, trailer) {
  try {
    await connection.execute(
      'UPDATE trailers SET numero=?, type=?, modelo=?, año=?, placa=?, status=? WHERE id=?',
      [trailer.numero, trailer.type, trailer.modelo, trailer.año, trailer.placa, trailer.status, id]
    );
    return { id, ...trailer };
  } catch (error) {
    console.error('[DB] Error updating trailer:', error.message);
    throw error;
  }
}

async function deleteTrailer(id) {
  try {
    await connection.execute('DELETE FROM trailers WHERE id=?', [id]);
  } catch (error) {
    console.error('[DB] Error deleting trailer:', error.message);
    throw error;
  }
}

// Trailer Locations functions
async function getTrailerLocations() {
  try {
    const [rows] = await connection.execute('SELECT * FROM trailer_locations');
    return rows;
  } catch (error) {
    console.error('[DB] Error getting trailer locations:', error.message);
    throw error;
  }
}

async function createTrailerLocation(location) {
  try {
    const [result] = await connection.execute(
      'INSERT INTO trailer_locations (trailerNumber, currentLocation, timestamp) VALUES (?, ?, ?)',
      [location.trailerNumber, location.currentLocation, location.timestamp]
    );
    return { id: result.insertId, ...location };
  } catch (error) {
    console.error('[DB] Error creating trailer location:', error.message);
    throw error;
  }
}

async function updateTrailerLocation(id, location) {
  try {
    await connection.execute(
      'UPDATE trailer_locations SET trailerNumber=?, currentLocation=?, timestamp=? WHERE id=?',
      [location.trailerNumber, location.currentLocation, location.timestamp, id]
    );
    return { id, ...location };
  } catch (error) {
    console.error('[DB] Error updating trailer location:', error.message);
    throw error;
  }
}

async function deleteTrailerLocation(id) {
  try {
    await connection.execute('DELETE FROM trailer_locations WHERE id=?', [id]);
  } catch (error) {
    console.error('[DB] Error deleting trailer location:', error.message);
    throw error;
  }
}

// Orders functions
async function getOrders() {
  try {
    const [rows] = await connection.execute('SELECT * FROM orders');
    return rows;
  } catch (error) {
    console.error('[DB] Error getting orders:', error.message);
    throw error;
  }
}

async function createOrder(order) {
  try {
    const [result] = await connection.execute(
      'INSERT INTO orders (orderNumber, description, status) VALUES (?, ?, ?)',
      [order.orderNumber, order.description, order.status]
    );
    return { id: result.insertId, ...order };
  } catch (error) {
    console.error('[DB] Error creating order:', error.message);
    throw error;
  }
}

// Partes/Inventory functions
async function getPartes() {
  try {
    const [rows] = await connection.execute('SELECT * FROM partes');
    return rows;
  } catch (error) {
    console.error('[DB] Error getting partes:', error.message);
    throw error;
  }
}

async function createParte(parte) {
  try {
    const [result] = await connection.execute(
      'INSERT INTO partes (sku, barCodes, category, part, provider, brand, um, area, imagen, precio, cantidad, onHand) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [parte.sku, parte.barCodes, parte.category, parte.part, parte.provider, parte.brand, parte.um, parte.area, parte.imagen, parte.precio, parte.cantidad, parte.onHand]
    );
    return { id: result.insertId, ...parte };
  } catch (error) {
    console.error('[DB] Error creating parte:', error.message);
    throw error;
  }
}

async function updateParte(id, parte) {
  try {
    await connection.execute(
      'UPDATE partes SET sku=?, barCodes=?, category=?, part=?, provider=?, brand=?, um=?, area=?, imagen=?, precio=?, cantidad=?, onHand=? WHERE id=? OR sku=?',
      [parte.sku, parte.barCodes, parte.category, parte.part, parte.provider, parte.brand, parte.um, parte.area, parte.imagen, parte.precio, parte.cantidad, parte.onHand, id, id]
    );
    return { id, ...parte };
  } catch (error) {
    console.error('[DB] Error updating parte:', error.message);
    throw error;
  }
}

async function deleteParte(id) {
  try {
    await connection.execute('DELETE FROM partes WHERE id=? OR sku=?', [id, id]);
  } catch (error) {
    console.error('[DB] Error deleting parte:', error.message);
    throw error;
  }
}

// Pending Parts functions
async function getPendingParts() {
  try {
    const [rows] = await connection.execute('SELECT * FROM pending_parts');
    return rows;
  } catch (error) {
    console.error('[DB] Error getting pending parts:', error.message);
    throw error;
  }
}

// PDF Generation (mock)
async function generatePDF(data) {
  console.log('PDF generation requested:', data);
  return '/path/to/generated/pdf.pdf';
}

module.exports = {
  connection,
  execute: (query, params) => connection.execute(query, params),
  getTrailers,
  createTrailer,
  updateTrailer,
  deleteTrailer,
  getTrailerLocations,
  createTrailerLocation,
  updateTrailerLocation,
  deleteTrailerLocation,
  getOrders,
  createOrder,
  getPartes,
  createParte,
  updateParte,
  deleteParte,
  getPendingParts,
  generatePDF
};