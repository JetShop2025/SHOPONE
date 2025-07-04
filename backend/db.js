const mysql = require('mysql2/promise');
const connection = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  database: process.env.MYSQL_DATABASE,
  password: process.env.MYSQL_PASSWORD,
  port: process.env.MYSQL_PORT
});

// Mock data for development - replace with actual database calls when needed
const mockData = {
  trailers: [],
  trailerLocations: [],
  orders: [],
  partes: [],
  pendingParts: []
};

// Trailers functions
async function getTrailers() {
  try {
    // Try database first, fallback to mock data
    const [rows] = await connection.execute('SELECT * FROM trailers');
    return rows;
  } catch (error) {
    console.log('Database not available, using mock data for trailers');
    return mockData.trailers;
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
    console.log('Database not available, using mock data for create trailer');
    const newTrailer = { id: Date.now(), ...trailer };
    mockData.trailers.push(newTrailer);
    return newTrailer;
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
    console.log('Database not available, using mock data for update trailer');
    const index = mockData.trailers.findIndex(t => t.id == id);
    if (index !== -1) {
      mockData.trailers[index] = { id, ...trailer };
      return mockData.trailers[index];
    }
    return { id, ...trailer };
  }
}

async function deleteTrailer(id) {
  try {
    await connection.execute('DELETE FROM trailers WHERE id=?', [id]);
  } catch (error) {
    console.log('Database not available, using mock data for delete trailer');
    const index = mockData.trailers.findIndex(t => t.id == id);
    if (index !== -1) {
      mockData.trailers.splice(index, 1);
    }
  }
}

// Trailer Locations functions
async function getTrailerLocations() {
  try {
    const [rows] = await connection.execute('SELECT * FROM trailer_locations');
    return rows;
  } catch (error) {
    console.log('Database not available, using mock data for trailer locations');
    return mockData.trailerLocations;
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
    console.log('Database not available, using mock data for create trailer location');
    const newLocation = { id: Date.now(), ...location };
    mockData.trailerLocations.push(newLocation);
    return newLocation;
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
    console.log('Database not available, using mock data for update trailer location');
    const index = mockData.trailerLocations.findIndex(l => l.id == id);
    if (index !== -1) {
      mockData.trailerLocations[index] = { id, ...location };
      return mockData.trailerLocations[index];
    }
    return { id, ...location };
  }
}

async function deleteTrailerLocation(id) {
  try {
    await connection.execute('DELETE FROM trailer_locations WHERE id=?', [id]);
  } catch (error) {
    console.log('Database not available, using mock data for delete trailer location');
    const index = mockData.trailerLocations.findIndex(l => l.id == id);
    if (index !== -1) {
      mockData.trailerLocations.splice(index, 1);
    }
  }
}

// Orders functions
async function getOrders() {
  try {
    const [rows] = await connection.execute('SELECT * FROM orders');
    return rows;
  } catch (error) {
    console.log('Database not available, using mock data for orders');
    return mockData.orders;
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
    console.log('Database not available, using mock data for create order');
    const newOrder = { id: Date.now(), ...order };
    mockData.orders.push(newOrder);
    return newOrder;
  }
}

// Partes/Inventory functions
async function getPartes() {
  try {
    const [rows] = await connection.execute('SELECT * FROM partes');
    return rows;
  } catch (error) {
    console.log('Database not available, using mock data for partes');
    return mockData.partes;
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
    console.log('Database not available, using mock data for create parte');
    const newParte = { id: Date.now(), ...parte };
    mockData.partes.push(newParte);
    return newParte;
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
    console.log('Database not available, using mock data for update parte');
    const index = mockData.partes.findIndex(p => p.id == id || p.sku == id);
    if (index !== -1) {
      mockData.partes[index] = { id, ...parte };
      return mockData.partes[index];
    }
    return { id, ...parte };
  }
}

async function deleteParte(id) {
  try {
    await connection.execute('DELETE FROM partes WHERE id=? OR sku=?', [id, id]);
  } catch (error) {
    console.log('Database not available, using mock data for delete parte');
    const index = mockData.partes.findIndex(p => p.id == id || p.sku == id);
    if (index !== -1) {
      mockData.partes.splice(index, 1);
    }
  }
}

// Pending Parts functions
async function getPendingParts() {
  try {
    const [rows] = await connection.execute('SELECT * FROM pending_parts');
    return rows;
  } catch (error) {
    console.log('Database not available, using mock data for pending parts');
    return mockData.pendingParts;
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