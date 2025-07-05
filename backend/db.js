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
    console.log('[DB] Executing query: SELECT * FROM work_orders');
    const [rows] = await connection.execute('SELECT * FROM work_orders');
    console.log(`[DB] Found ${rows.length} work orders in database`);
    
    // Parse JSON fields
    const parsedRows = rows.map(row => ({
      ...row,
      parts: row.parts ? JSON.parse(row.parts) : [],
      mechanics: row.mechanics ? JSON.parse(row.mechanics) : [],
      extraOptions: row.extraOptions ? JSON.parse(row.extraOptions) : []
    }));
    
    return parsedRows;
  } catch (error) {
    console.error('[DB] Error getting work orders:', error.message);
    console.error('[DB] Full error:', error);
    throw error;
  }
}

async function createOrder(order) {
  try {
    console.log('[DB] Creating order with data:', order);
      // Convert undefined values to null for MySQL compatibility
    // Remove orderNumber as it doesn't exist in the database table
    const safeValues = [
      order.billToCo || null,
      order.trailer || null,
      order.mechanic || null,
      order.date || null,
      order.description || null,
      order.totalHrs || null,
      order.totalLabAndParts || null,
      order.status || 'PRE W.O',
      order.idClassic || null,
      JSON.stringify(order.mechanics || []),
      JSON.stringify(order.extraOptions || []),
      JSON.stringify(order.parts || [])
    ];

    const [result] = await connection.execute(
      'INSERT INTO work_orders (billToCo, trailer, mechanic, date, description, totalHrs, totalLabAndParts, status, idClassic, mechanics, extraOptions, parts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      safeValues
    );
    
    console.log('[DB] Successfully created work order with ID:', result.insertId);
    return { id: result.insertId, ...order };
  } catch (error) {
    console.error('[DB] Error creating order:', error.message);
    console.error('[DB] Full error details:', error);
    throw error;
  }
}

async function updateOrder(id, order) {
  try {
    console.log('[DB] Updating order with ID:', id, 'and data:', order);
      // Convert undefined values to null for MySQL compatibility
    const safeValues = [
      order.billToCo || null,
      order.trailer || null,
      order.mechanic || null,
      order.date || null,
      order.description || null,
      order.totalHrs || null,
      order.totalLabAndParts || null,
      order.status || 'PRE W.O',
      order.idClassic || null,
      JSON.stringify(order.mechanics || []),
      JSON.stringify(order.extraOptions || []),
      JSON.stringify(order.parts || []),
      id
    ];

    const [result] = await connection.execute(
      'UPDATE work_orders SET billToCo = ?, trailer = ?, mechanic = ?, date = ?, description = ?, totalHrs = ?, totalLabAndParts = ?, status = ?, idClassic = ?, mechanics = ?, extraOptions = ?, parts = ? WHERE id = ?',
      safeValues
    );
    
    console.log('[DB] Successfully updated work order with ID:', id);
    return { id, ...order };
  } catch (error) {
    console.error('[DB] Error updating order:', error.message);
    console.error('[DB] Full error details:', error);
    throw error;
  }
}

async function deleteOrder(id) {
  try {
    console.log('[DB] Deleting work order with ID:', id);
    
    // First delete related work order parts
    await connection.execute('DELETE FROM work_order_parts WHERE work_order_id = ?', [id]);
    console.log('[DB] Deleted related work order parts for order:', id);
    
    // Then delete the work order itself
    const [result] = await connection.execute('DELETE FROM work_orders WHERE id = ?', [id]);
    
    console.log('[DB] Successfully deleted work order with ID:', id);
    return { success: true, deletedId: id };
  } catch (error) {
    console.error('[DB] Error deleting work order:', error.message);
    console.error('[DB] Full error details:', error);
    throw error;
  }
}

// Work Order Parts functions
async function createWorkOrderPart(workOrderPart) {
  try {
    console.log('[DB] Creating work order part:', workOrderPart);
    
    const [result] = await connection.execute(
      'INSERT INTO work_order_parts (work_order_id, sku, part_name, qty_used, cost) VALUES (?, ?, ?, ?, ?)',
      [
        workOrderPart.work_order_id,
        workOrderPart.sku || null,
        workOrderPart.part_name || null,
        workOrderPart.qty_used || 1,
        workOrderPart.cost || 0
      ]
    );
    
    console.log('[DB] Successfully created work order part');
    return { id: result.insertId, ...workOrderPart };
  } catch (error) {
    console.error('[DB] Error creating work order part:', error.message);
    throw error;
  }
}

async function deductInventory(partsToDeduct) {
  try {
    console.log('[DB] Deducting inventory for parts:', partsToDeduct);
    
    for (const part of partsToDeduct) {
      // Get current inventory for this SKU
      const [currentRows] = await connection.execute(
        'SELECT * FROM inventory WHERE sku = ?',
        [part.sku]
      );
      
      if (currentRows.length > 0) {
        const currentPart = currentRows[0];
        const currentOnHand = Number(currentPart.onHand) || 0;
        const qtyToDeduct = Number(part.qty) || 0;
        const newOnHand = Math.max(0, currentOnHand - qtyToDeduct); // Don't go below 0
        
        // Update the inventory
        await connection.execute(
          'UPDATE inventory SET onHand = ?, salidasWo = COALESCE(salidasWo, 0) + ? WHERE sku = ?',
          [newOnHand, qtyToDeduct, part.sku]
        );
        
        console.log(`[DB] Updated inventory for ${part.sku}: ${currentOnHand} -> ${newOnHand} (deducted ${qtyToDeduct})`);
      } else {
        console.warn(`[DB] SKU ${part.sku} not found in inventory, skipping deduction`);
      }
    }
    
    console.log('[DB] Successfully deducted inventory');
    return { success: true, deducted: partsToDeduct.length };
  } catch (error) {
    console.error('[DB] Error deducting inventory:', error.message);
    throw error;
  }
}

// Partes/Inventory functions
async function getPartes() {
  try {
    // Intentar con diferentes nombres de tabla comunes
    const tableNames = ['inventory', 'parts', 'partes', 'inventario'];
    
    for (const tableName of tableNames) {
      try {
        console.log(`[DB] Trying table: ${tableName}`);
        const [rows] = await connection.execute(`SELECT * FROM ${tableName}`);
        console.log(`[DB] Found ${rows.length} items in table ${tableName}`);
        return rows;
      } catch (error) {
        console.log(`[DB] Table ${tableName} not found, trying next...`);
        continue;
      }
    }
    
    // Si ninguna tabla existe, devolver array vacío
    console.log('[DB] No inventory table found, returning empty array');
    return [];
  } catch (error) {
    console.error('[DB] Error getting partes:', error.message);
    return [];
  }
}

async function createParte(parte) {
  try {    // Convert undefined values to null for MySQL compatibility
    const safeValues = [
      parte.sku || null,
      parte.barCodes || null,
      parte.category || null,
      parte.part || null,  // Use 'part' for inventory table
      parte.provider || null,
      parte.brand || null,
      parte.um || null,
      parte.area || null,
      parte.imagen || null,
      parte.precio || null,
      parte.onHand || null,
      parte.receive || null,  // Add receive column
      parte.salidasWo || null,  // Add salidasWo column
      parte.invoiceLink || null  // Add invoiceLink column
    ];

    // Use the real table name that exists in your database
    const [result] = await connection.execute(
      'INSERT INTO inventory (sku, barCodes, category, part, provider, brand, um, area, imagen, precio, onHand, receive, salidasWo, invoiceLink) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      safeValues
    );
    return { id: result.insertId, ...parte };
  } catch (error) {
    console.error('[DB] Error creating parte:', error.message);
    throw error;
  }
}

async function updateParte(id, parte) {
  try {
    // Convert undefined values to null for MySQL compatibility
    const safeValues = [
      parte.sku || null,
      parte.barCodes || null,
      parte.category || null,
      parte.part || null,  // Use 'part' for inventory table
      parte.provider || null,
      parte.brand || null,
      parte.um || null,
      parte.area || null,
      parte.imagen || null,
      parte.precio || null,
      parte.onHand || null,
      parte.receive || null,  // Add receive column
      parte.salidasWo || null,  // Add salidasWo column  
      parte.invoiceLink || null,  // Add invoiceLink column
      id
    ];

    await connection.execute(
      'UPDATE inventory SET sku=?, barCodes=?, category=?, part=?, provider=?, brand=?, um=?, area=?, imagen=?, precio=?, onHand=?, receive=?, salidasWo=?, invoiceLink=? WHERE id=?',
      safeValues
    );
    return { id, ...parte };
  } catch (error) {
    console.error('[DB] Error updating parte:', error.message);
    throw error;
  }
}

async function deleteParte(id) {
  try {
    await connection.execute('DELETE FROM inventory WHERE id=?', [id]);
  } catch (error) {
    console.error('[DB] Error deleting parte:', error.message);
    throw error;
  }
}

// Pending Parts functions
async function getPendingParts() {
  try {
    console.log('[DB] Getting pending parts from receives table');
    const [rows] = await connection.execute('SELECT * FROM receives WHERE estatus = "PENDING"');
    console.log(`[DB] Found ${rows.length} pending parts in receives table`);
    return rows;
  } catch (error) {
    console.error('[DB] Error getting pending parts from receives table:', error.message);
    throw error;
  }
}

async function createPendingPart(pendingPart) {
  try {
    console.log('[DB] Creating pending part in receives table:', pendingPart);
    
    // Map the fields from the frontend to the receives table structure
    const [result] = await connection.execute(
      'INSERT INTO receives (sku, category, item, provider, brand, um, destino_trailer, invoice, qty, costTax, totalPOClassic, fecha, estatus, invoiceLink) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        pendingPart.sku || null,
        pendingPart.category || null,
        pendingPart.item || pendingPart.part || null,
        pendingPart.provider || null,
        pendingPart.brand || null,
        pendingPart.um || null,
        pendingPart.destino_trailer || pendingPart.trailer || null,
        pendingPart.invoice || null,
        pendingPart.qty || pendingPart.quantity || 1,
        pendingPart.costTax || null,
        pendingPart.totalPOClassic || null,
        pendingPart.fecha || new Date().toISOString().split('T')[0],
        pendingPart.estatus || 'PENDING',
        pendingPart.invoiceLink || null
      ]
    );
    
    // Return the created record
    const [newRecord] = await connection.execute(
      'SELECT * FROM receives WHERE id = ?',
      [result.insertId]
    );
    
    console.log('[DB] Successfully created pending part in receives table');
    return newRecord[0];
  } catch (error) {
    console.error('[DB] Error creating pending part in receives table:', error.message);
    throw error;
  }
}

async function updatePendingPart(id, pendingPart) {
  try {
    console.log('[DB] Updating pending part in receives table, id:', id, 'data:', pendingPart);
    
    // Convert undefined values to null for MySQL compatibility
    const safeValues = [
      pendingPart.sku || null,
      pendingPart.category || null,
      pendingPart.item || pendingPart.part || null,
      pendingPart.provider || null,
      pendingPart.brand || null,
      pendingPart.um || null,
      pendingPart.destino_trailer || pendingPart.trailer || null,
      pendingPart.invoice || null,
      pendingPart.qty || pendingPart.quantity || 1,
      pendingPart.costTax || null,
      pendingPart.totalPOClassic || null,
      pendingPart.fecha || new Date().toISOString().split('T')[0],
      pendingPart.estatus || 'PENDING',
      pendingPart.invoiceLink || null,
      id
    ];

    await connection.execute(
      'UPDATE receives SET sku=?, category=?, item=?, provider=?, brand=?, um=?, destino_trailer=?, invoice=?, qty=?, costTax=?, totalPOClassic=?, fecha=?, estatus=?, invoiceLink=? WHERE id=?',
      safeValues
    );
    
    console.log('[DB] Successfully updated pending part in receives table');
    return { id, ...pendingPart };
  } catch (error) {
    console.error('[DB] Error updating pending part in receives table:', error.message);
    throw error;
  }
}

async function deletePendingPart(id) {
  try {
    console.log('[DB] Deleting pending part from receives table, id:', id);
    await connection.execute('DELETE FROM receives WHERE id=?', [id]);
    console.log('[DB] Successfully deleted pending part from receives table');
  } catch (error) {
    console.error('[DB] Error deleting pending part from receives table:', error.message);
    throw error;
  }
}

// Users functions (para login)
async function getUsers() {
  try {
    const [rows] = await connection.execute('SELECT * FROM users');
    return rows;
  } catch (error) {
    console.error('[DB] Error getting users:', error.message);
    throw error;
  }
}

// PDF Generation (real database function)
async function generatePDF(data) {
  try {
    console.log('[DB] PDF generation requested:', data);
    // This should connect to a real PDF generation service or database function
    throw new Error('PDF generation not implemented - requires real database implementation');
  } catch (error) {
    console.error('[DB] Error generating PDF:', error.message);
    throw error;
  }
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
  updateTrailerLocation,  deleteTrailerLocation,
  getOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  createWorkOrderPart,
  deductInventory,
  getPartes,
  createParte,
  updateParte,
  deleteParte,
  getPendingParts,
  createPendingPart,
  updatePendingPart,
  deletePendingPart,
  getUsers,
  generatePDF
};