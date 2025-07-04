const mysql = require('mysql2/promise');
const connection = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  database: process.env.MYSQL_DATABASE,
  password: process.env.MYSQL_PASSWORD,
  port: process.env.MYSQL_PORT
});

// Trailers functions
async function getTrailers() {
  const [rows] = await connection.execute('SELECT * FROM trailers');
  return rows;
}

async function createTrailer(trailer) {
  const [result] = await connection.execute(
    'INSERT INTO trailers (numero, type, modelo, año, placa, status) VALUES (?, ?, ?, ?, ?, ?)',
    [trailer.numero, trailer.type, trailer.modelo, trailer.año, trailer.placa, trailer.status]
  );
  return { id: result.insertId, ...trailer };
}

async function updateTrailer(id, trailer) {
  await connection.execute(
    'UPDATE trailers SET numero=?, type=?, modelo=?, año=?, placa=?, status=? WHERE id=?',
    [trailer.numero, trailer.type, trailer.modelo, trailer.año, trailer.placa, trailer.status, id]
  );
  return { id, ...trailer };
}

async function deleteTrailer(id) {
  await connection.execute('DELETE FROM trailers WHERE id=?', [id]);
}

// Trailer Locations functions
async function getTrailerLocations() {
  const [rows] = await connection.execute('SELECT * FROM trailer_locations');
  return rows;
}

async function createTrailerLocation(location) {
  const [result] = await connection.execute(
    'INSERT INTO trailer_locations (trailerNumber, currentLocation, timestamp) VALUES (?, ?, ?)',
    [location.trailerNumber, location.currentLocation, location.timestamp]
  );
  return { id: result.insertId, ...location };
}

async function updateTrailerLocation(id, location) {
  await connection.execute(
    'UPDATE trailer_locations SET trailerNumber=?, currentLocation=?, timestamp=? WHERE id=?',
    [location.trailerNumber, location.currentLocation, location.timestamp, id]
  );
  return { id, ...location };
}

async function deleteTrailerLocation(id) {
  await connection.execute('DELETE FROM trailer_locations WHERE id=?', [id]);
}

// Orders functions
async function getOrders() {
  const [rows] = await connection.execute('SELECT * FROM orders');
  return rows;
}

async function createOrder(order) {
  const [result] = await connection.execute(
    'INSERT INTO orders (orderNumber, description, status) VALUES (?, ?, ?)',
    [order.orderNumber, order.description, order.status]
  );
  return { id: result.insertId, ...order };
}

// Partes/Inventory functions
async function getPartes() {
  const [rows] = await connection.execute('SELECT * FROM partes');
  return rows;
}

async function createParte(parte) {
  const [result] = await connection.execute(
    'INSERT INTO partes (sku, barCodes, category, part, provider, brand, um, area, imagen, precio, cantidad, onHand) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [parte.sku, parte.barCodes, parte.category, parte.part, parte.provider, parte.brand, parte.um, parte.area, parte.imagen, parte.precio, parte.cantidad, parte.onHand]
  );
  return { id: result.insertId, ...parte };
}

async function updateParte(id, parte) {
  await connection.execute(
    'UPDATE partes SET sku=?, barCodes=?, category=?, part=?, provider=?, brand=?, um=?, area=?, imagen=?, precio=?, cantidad=?, onHand=? WHERE id=? OR sku=?',
    [parte.sku, parte.barCodes, parte.category, parte.part, parte.provider, parte.brand, parte.um, parte.area, parte.imagen, parte.precio, parte.cantidad, parte.onHand, id, id]
  );
  return { id, ...parte };
}

async function deleteParte(id) {
  await connection.execute('DELETE FROM partes WHERE id=? OR sku=?', [id, id]);
}

// Pending Parts functions
async function getPendingParts() {
  const [rows] = await connection.execute('SELECT * FROM pending_parts');
  return rows;
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