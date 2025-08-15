// Limpieza automática de receives para evitar alertas fantasma
async function cleanReceivesAlerts() {
  try {
    // 1. Si hay USED con qty_remaining > 0, poner qty_remaining = 0
    await connection.execute("UPDATE receives SET qty_remaining = 0 WHERE estatus = 'USED' AND qty_remaining > 0");
    // 2. Si hay PENDING con qty_remaining = 0, poner estatus = 'USED'
    await connection.execute("UPDATE receives SET estatus = 'USED' WHERE estatus = 'PENDING' AND qty_remaining = 0");
    console.log('[DB] Limpieza de receives para alertas fantasma ejecutada');
  } catch (err) {
    console.error('[DB] Error en limpieza de receives:', err.message);
  }
}
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
  // Always return DATE/DATETIME as strings to avoid timezone shifts in JS
  dateStrings: true,
  // Keep server/client in local timezone for consistency (no implicit UTC conversions)
  timezone: 'local',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 15000
});

// Basic pool diagnostics
connection.on?.('error', (err) => {
  console.error('[DB] Pool error event:', err.code || err.message);
});

connection.on?.('connection', (conn) => {
  try {
    conn.on('error', (err) => {
      console.error('[DB] Connection-level error:', err.code || err.message);
    });
  } catch {}
});

// --- KEEP ALIVE & AUTO-RECOVERY -------------------------------------------------
let consecutiveKeepAliveFailures = 0;
const MAX_KEEPALIVE_FAILS = 5;
const KEEPALIVE_MS = parseInt(process.env.DB_KEEPALIVE_MS || '30000', 10);

async function runKeepAlive() {
  try {
    const start = Date.now();
    await connection.query('SELECT 1');
    const duration = Date.now() - start;
    if (consecutiveKeepAliveFailures > 0) {
      console.log(`[DB] Keep-alive OK after ${consecutiveKeepAliveFailures} failure(s). (${duration}ms)`);
    }
    consecutiveKeepAliveFailures = 0;
  } catch (err) {
    consecutiveKeepAliveFailures++;
    console.warn(`[DB] Keep-alive failed (#${consecutiveKeepAliveFailures}):`, err.code || err.message);
    if (consecutiveKeepAliveFailures >= MAX_KEEPALIVE_FAILS) {
      console.error('[DB] Too many keep-alive failures. Consider investigating network / DB availability.');
    }
  }
}

setInterval(runKeepAlive, KEEPALIVE_MS).unref();

// Expose for optional manual trigger
async function forcePing() { return runKeepAlive(); }

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

// Función para crear tabla de auditoría si no existe.
// Y asegurar columna employeeWrittenHours en work_orders
// Asegura que la tabla work_orders tenga el campo employeeWrittenHours
async function ensureWorkOrdersTableHasEmployeeWrittenHours() {
  try {
    const [columns] = await connection.execute("SHOW COLUMNS FROM work_orders LIKE 'employeeWrittenHours'");
    if (!columns || columns.length === 0) {
      console.log('[DB] Adding employeeWrittenHours column to work_orders table...');
      await connection.execute('ALTER TABLE work_orders ADD COLUMN employeeWrittenHours VARCHAR(500) NULL');
      console.log('[DB] Column employeeWrittenHours added to work_orders table.');
    } else {
      console.log('[DB] work_orders table already has employeeWrittenHours column.');
    }
  } catch (err) {
    console.error('[DB] Error ensuring employeeWrittenHours column:', err.message);
  }
}

async function ensureAuditTableExists() {
  try {
    // Primero verificar si la tabla existe
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'audit_log'"
    );
    
    if (tables.length > 0) {
      // La tabla existe, verificar su estructura
      const [columns] = await connection.execute(
        "SHOW COLUMNS FROM audit_log"
      );
      
      const columnNames = columns.map(col => col.Field);
      console.log('[DB] Existing audit_log columns:', columnNames);
      
      // Si tiene ip_address, eliminarla
      if (columnNames.includes('ip_address')) {
        console.log('[DB] Removing ip_address column from audit_log');
        try {
          await connection.execute('ALTER TABLE audit_log DROP COLUMN ip_address');
          console.log('[DB] Successfully removed ip_address column');
        } catch (dropError) {
          console.log('[DB] Column ip_address may not exist or already removed:', dropError.message);
        }
      }
      
      // Asegurar que todas las columnas necesarias existen
      const requiredColumns = ['id', 'usuario', 'accion', 'tabla', 'registro_id', 'detalles', 'fecha'];
      for (const col of requiredColumns) {
        if (!columnNames.includes(col)) {
          console.log(`[DB] Adding missing column: ${col}`);
          // Agregar columnas faltantes según sea necesario
          if (col === 'usuario') {
            await connection.execute('ALTER TABLE audit_log ADD COLUMN usuario VARCHAR(100) NOT NULL DEFAULT "SYSTEM"');
          }
          // Agregar más columnas si es necesario...
        }
      }
    } else {
      // La tabla no existe, crearla
      console.log('[DB] Creating new audit_log table');
      await connection.execute(`
        CREATE TABLE audit_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
          accion VARCHAR(50) NOT NULL,
          tabla VARCHAR(100) NOT NULL,
          registro_id VARCHAR(100),
          detalles TEXT,
          fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_usuario (usuario),
          INDEX idx_accion (accion),
          INDEX idx_tabla (tabla),
          INDEX idx_fecha (fecha)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }
    
    console.log('[DB] Audit table ensured to exist with correct structure');
  } catch (error) {
    console.error('[DB] Error ensuring audit table:', error.message);
  }
}

// Call test connection and ensure tables structure on startup
testConnection().then(() => {
  ensureAuditTableExists();
  ensureReceivesTableStructure();
  ensureWorkOrdersTableHasEmployeeWrittenHours();
});

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

async function createTrailer(trailer, usuario = 'SYSTEM') {
  try {
    const [result] = await connection.execute(
      'INSERT INTO trailers (numero, type, modelo, año, placa, status) VALUES (?, ?, ?, ?, ?, ?)',
      [trailer.numero, trailer.type, trailer.modelo, trailer.año, trailer.placa, trailer.status]
    );
    
    const newTrailer = { id: result.insertId, ...trailer };
    
    // Registrar en auditoría
    await auditTrailerOperation(usuario, 'CREATE', result.insertId, null, null, newTrailer);
    
    return newTrailer;
  } catch (error) {
    console.error('[DB] Error creating trailer:', error.message);
    throw error;
  }
}

async function updateTrailer(id, trailer, usuario = 'SYSTEM') {
  try {
    // Obtener datos actuales para auditoría
    const [current] = await connection.execute('SELECT * FROM trailers WHERE id = ?', [id]);
    const oldData = current[0] || null;
    
    await connection.execute(
      'UPDATE trailers SET numero=?, type=?, modelo=?, año=?, placa=?, status=? WHERE id=?',
      [trailer.numero, trailer.type, trailer.modelo, trailer.año, trailer.placa, trailer.status, id]
    );
    
    const newData = { id, ...trailer };
    
    // Registrar en auditoría
    await auditTrailerOperation(usuario, 'UPDATE', id, null, oldData, newData);
    
    return newData;
  } catch (error) {
    console.error('[DB] Error updating trailer:', error.message);
    throw error;
  }
}

async function deleteTrailer(id, usuario = 'SYSTEM') {
  try {
    // Obtener datos antes de eliminar para auditoría
    const [current] = await connection.execute('SELECT * FROM trailers WHERE id = ?', [id]);
    const oldData = current[0] || null;
    
    await connection.execute('DELETE FROM trailers WHERE id=?', [id]);
    
    // Registrar en auditoría
    await auditTrailerOperation(usuario, 'DELETE', id, null, oldData, null);
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

// Orders functions - Optimizado para memoria
async function getOrders(limit = 100, offset = 0) {
  try {    // Validate and sanitize limit and offset to prevent SQL injection
    const safeLimit = Math.max(1, Math.min(50000, parseInt(limit) || 10000)); // Aumentar límite máximo
    const safeOffset = Math.max(0, parseInt(offset) || 0);
    
    // Use direct interpolation for LIMIT/OFFSET to avoid MySQL parameter issues
    const query = `SELECT * FROM work_orders ORDER BY id DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    console.log(`[DB] Executing optimized query with limit ${safeLimit}, offset ${safeOffset}`);
    const [rows] = await connection.execute(query);
    console.log(`[DB] Found ${rows.length} work orders in database`);
    
    // Parse JSON fields y forzar date como string YYYY-MM-DD (sin importar si es Date, string, null, undefined, etc)
    const parsedRows = rows.map(row => {
      let dateStr = '';
      if (typeof row.date === 'string') {
        const match = row.date.match(/^\d{4}-\d{2}-\d{2}/);
        dateStr = match ? match[0] : row.date;
      } else if (row.date) {
        try { dateStr = String(row.date).slice(0, 10); } catch { dateStr = ''; }
      } else {
        dateStr = '';
      }
      try {
        return {
          ...row,
          date: dateStr,
          parts: row.parts ? JSON.parse(row.parts) : [],
          mechanics: row.mechanics ? JSON.parse(row.mechanics) : [],
          extraOptions: row.extraOptions ? JSON.parse(row.extraOptions) : []
        };
      } catch (parseError) {
        console.warn(`[DB] Error parsing JSON for work order ${row.id}:`, parseError.message);
        return {
          ...row,
          date: dateStr,
          parts: [],
          mechanics: [],
          extraOptions: []
        };
      }
    });
    return parsedRows;
  } catch (error) {
    console.error('[DB] Error getting work orders:', error.message);
    console.error('[DB] Full error:', error);
    throw error;
  }
}

// Get work orders by trailer ID
async function getOrdersByTrailer(trailerId) {
  try {
    // Accept limit/offset for pagination (default: 10, 0)
    let limit = 10, offset = 0;
    if (arguments.length > 1 && typeof arguments[1] === 'object') {
      limit = Math.max(1, Math.min(100, parseInt(arguments[1].limit) || 10));
      offset = Math.max(0, parseInt(arguments[1].offset) || 0);
    }
    console.log(`[DB] Executing paginated query: SELECT * FROM work_orders WHERE trailer = ? ORDER BY date DESC LIMIT ${limit} OFFSET ${offset}`, trailerId);
    const [rows] = await connection.execute(
      `SELECT * FROM work_orders WHERE trailer = ? ORDER BY date DESC LIMIT ? OFFSET ?`,
      [trailerId, limit, offset]
    );
    // Get total count for pagination
    const [countRows] = await connection.execute(
      `SELECT COUNT(*) as total FROM work_orders WHERE trailer = ?`,
      [trailerId]
    );
    const total = countRows[0]?.total || 0;
    // Parse JSON fields and force date as string
    const parsedRows = rows.map(row => {
      let dateStr = '';
      if (typeof row.date === 'string') {
        const match = row.date.match(/^\d{4}-\d{2}-\d{2}/);
        dateStr = match ? match[0] : row.date;
      } else if (row.date) {
        try { dateStr = String(row.date).slice(0, 10); } catch { dateStr = ''; }
      } else {
        dateStr = '';
      }
      return {
        ...row,
        date: dateStr,
        parts: row.parts ? JSON.parse(row.parts) : [],
        mechanics: row.mechanics ? JSON.parse(row.mechanics) : [],
        extraOptions: row.extraOptions ? JSON.parse(row.extraOptions) : []
      };
    });
    return { data: parsedRows, total };
  } catch (error) {
    console.error('[DB] Error getting work orders by trailer:', error.message);
    throw error;
  }
}

// Get rental history for a trailer (use trailer_rental_history table)
async function getRentalHistory(trailerName) {
  try {
    console.log('[DB] Executing query: SELECT * FROM trailer_rental_history WHERE trailer_numero = ?', trailerName);
    const [rows] = await connection.execute('SELECT * FROM trailer_rental_history WHERE trailer_numero = ? ORDER BY created_at DESC', [trailerName]);
    console.log(`[DB] Found ${rows.length} rental records for trailer ${trailerName}`);
    return rows;
  } catch (error) {
    console.error('[DB] Error getting rental history:', error.message);
    // If trailer_rental_history table doesn't exist, return empty array
    return [];
  }
}

async function createOrder(order) {
  try {
    console.log('[DB] Creating order with data:', order);
    const usuario = order.usuario || 'system';
    
    // Convert undefined values to null for MySQL compatibility

    const safeValues = [
      order.billToCo || null,
      order.trailer || null,
      order.mechanic || null,
      order.date || null,
      order.description || null,
      order.totalHrs || null,
      order.totalLabAndParts || null,
      order.status || 'PROCESSING',
      order.idClassic || null,
      JSON.stringify(order.mechanics || []),
      JSON.stringify(order.extraOptions || []),
      JSON.stringify(order.parts || []),
      order.employeeWrittenHours || null
    ];

    const [result] = await connection.execute(
      'INSERT INTO work_orders (billToCo, trailer, mechanic, date, description, totalHrs, totalLabAndParts, status, idClassic, mechanics, extraOptions, parts, employeeWrittenHours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      safeValues
    );
    
    const newOrderId = result.insertId;
    console.log('[DB] Successfully created work order with ID:', newOrderId);
    
    // Registrar en auditoría usando función especializada
    await auditWorkOrderOperation(
      usuario,
      'CREATE',
      newOrderId,
      null,
      null,
      order
    );
    
    return { id: newOrderId, ...order };
  } catch (error) {
    console.error('[DB] Error creating order:', error.message);
    console.error('[DB] Full error details:', error);
    throw error;
  }
}

async function updateOrder(id, order) {
  try {
    console.log('[DB] Updating order with ID:', id, 'and data:', order);
    const usuario = order.usuario || 'system';

    // Obtener datos actuales para comparación
    const [currentRows] = await connection.execute('SELECT * FROM work_orders WHERE id = ?', [id]);
    const currentData = currentRows[0];
    // LOG: Valor crudo de la fecha antes de cualquier transformación
    console.log('[DEBUG][W.O. DATE] Valor crudo de currentData.date desde DB:', currentData.date, 'Tipo:', typeof currentData.date);

    // Agrupar partes por SKU+nombre para evitar duplicados y sumar cantidades
    function groupParts(partsArr) {
      const grouped = {};
      for (const p of partsArr) {
        if (!p.sku) continue;
        const key = `${p.sku || ''}__${p.part || p.part_name || ''}`;
        const qty = Number(p.qty) || 0;
        if (!grouped[key]) {
          grouped[key] = { ...p, qty };
        } else {
          grouped[key].qty += qty;
        }
      }
      return grouped;
    }

    let oldParts = [];
    try {
      oldParts = currentData && currentData.parts ? JSON.parse(currentData.parts) : [];
    } catch (e) {
      oldParts = [];
    }
    const newParts = Array.isArray(order.parts) ? order.parts : [];

    const groupedOld = groupParts(oldParts);
    const groupedNew = groupParts(newParts);

    // Detectar partes nuevas o aumentos de cantidad (por clave agrupada)
    const partsToDeduct = [];
    for (const key of Object.keys(groupedNew)) {
      const newPart = groupedNew[key];
      const oldPart = groupedOld[key];
      const newQty = Number(newPart.qty) || 0;
      const oldQty = oldPart ? (Number(oldPart.qty) || 0) : 0;
      if (!oldPart && newQty > 0) {
        // Parte completamente nueva
        partsToDeduct.push({ ...newPart, qty: newQty });
      } else if (oldPart && newQty > oldQty) {
        // Parte existente, pero aumentó la cantidad
        partsToDeduct.push({ ...newPart, qty: newQty - oldQty });
      }
      // Si la cantidad bajó o es igual, no descontar nada
    }

    // Actualizar la work order (sin tocar work_order_parts aún)
    // Fecha: preservar tal cual si no se envía una válida; si se envía string válido YYYY-MM-DD usarlo sin convertir zona horaria
    let originalDate = currentData.date;
    if (typeof originalDate === 'string') {
      originalDate = originalDate.slice(0, 10);
    }
    // Si order.date viene como string 'YYYY-MM-DD', usarlo; si viene vacío/undefined, mantener originalDate
    if (order && typeof order.date === 'string') {
      const trimmed = order.date.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        originalDate = trimmed; // usar exactamente lo que envió el cliente
      }
      // cualquier otro formato se ignora para evitar sobrescribir con valores inválidos
    }
    const safeValues = [
      order.billToCo || null,
      order.trailer || null,
      order.mechanic || null,
      originalDate || null,
      order.description || null,
      order.totalHrs || null,
      order.totalLabAndParts || null,
      order.status || 'PROCESSING',
      order.idClassic || null,
      JSON.stringify(order.mechanics || []),
      JSON.stringify(order.extraOptions || []),
      JSON.stringify(Object.values(groupedNew)), // partes agrupadas y sumadas
      order.employeeWrittenHours || null,
      id
    ];
    // LOG: Valor de la fecha que se usará en el UPDATE
  console.log('[DEBUG][W.O. DATE] Valor de date para UPDATE (sin TZ conv):', originalDate, 'Tipo:', typeof originalDate);
    const [result] = await connection.execute(
      'UPDATE work_orders SET billToCo = ?, trailer = ?, mechanic = ?, date = ?, description = ?, totalHrs = ?, totalLabAndParts = ?, status = ?, idClassic = ?, mechanics = ?, extraOptions = ?, parts = ?, employeeWrittenHours = ? WHERE id = ?',
      safeValues
    );
    console.log('[DB] Successfully updated work order with ID:', id);
    // LOG: Valor de la fecha después de UPDATE
    console.log('[DEBUG][W.O. DATE] UPDATE ejecutado con date =', originalDate);

    // Descontar solo la diferencia positiva de inventario (por parte agrupada)
    if (partsToDeduct.length > 0) {
      console.log(`[DB] Detected ${partsToDeduct.length} grouped parts to deduct from inventory (FIFO, only positive difference)`);
      const fifoResult = await module.exports.deductInventoryFIFO(partsToDeduct, usuario);
      // Insertar solo los work_order_parts correspondientes a la diferencia agrupada
      for (let i = 0; i < partsToDeduct.length; i++) {
        const part = partsToDeduct[i];
        let fifoInfo = null;
        if (fifoResult && fifoResult.details && Array.isArray(fifoResult.details)) {
          fifoInfo = fifoResult.details.find(r => r.sku === part.sku);
        }
        await module.exports.createWorkOrderPart({
          work_order_id: id,
          sku: part.sku,
          part_name: part.part || part.part_name || '',
          qty_used: Number(part.qty) || 1,
          cost: Number(part.cost) || 0,
          usuario: usuario
        }, fifoInfo);
      }
    }

    // Registrar cambios en auditoría usando función especializada
    await auditWorkOrderOperation(
      usuario,
      'UPDATE',
      id,
      null,
      currentData,
      {
        billToCo: order.billToCo,
        trailer: order.trailer,
        mechanic: order.mechanic,
        date: order.date,
        description: order.description,
        totalHrs: order.totalHrs,
        totalLabAndParts: order.totalLabAndParts,
        status: order.status,
        idClassic: order.idClassic
      }
    );

    return { id, ...order };
  } catch (error) {
    console.error('[DB] Error updating order:', error.message);
    console.error('[DB] Full error details:', error);
    throw error;
  }
}

async function deleteOrder(id, usuario = 'system') {
  try {
    console.log('[DB] Deleting work order with ID:', id);
    
    // Obtener datos antes de eliminar para auditoría
    const [orderRows] = await connection.execute('SELECT * FROM work_orders WHERE id = ?', [id]);
    const orderData = orderRows[0];
    
    // First delete related work order parts
    await connection.execute('DELETE FROM work_order_parts WHERE work_order_id = ?', [id]);
    console.log('[DB] Deleted related work order parts for order:', id);
    
    // Then delete the work order itself
    const [result] = await connection.execute('DELETE FROM work_orders WHERE id = ?', [id]);
    
    console.log('[DB] Successfully deleted work order with ID:', id);
    
    // Registrar en auditoría
    if (orderData) {
      await logAuditEvent(
        usuario,
        'DELETE',
        'work_orders',
        id,
        {
          action: 'Work Order eliminada',
          deletedData: {
            customer: orderData.billToCo,
            trailer: orderData.trailer,
            mechanic: orderData.mechanic,
            totalCost: orderData.totalLabAndParts,
            status: orderData.status
          }
        }
      );
    }
    
    return { success: true, deletedId: id };
  } catch (error) {
    console.error('[DB] Error deleting work order:', error.message);
    console.error('[DB] Full error details:', error);
    throw error;
  }
}

// Get single work order by ID
async function getOrderById(id) {
  try {
    console.log('[DB] Executing query: SELECT * FROM work_orders WHERE id = ?', id);
    const [rows] = await connection.execute('SELECT * FROM work_orders WHERE id = ?', [id]);
    console.log(`[DB] Found ${rows.length} work order(s) with ID ${id}`);
    
    if (rows.length === 0) {
      return null;
    }
    
    // Parse JSON fields y forzar date como string YYYY-MM-DD (sin importar si es Date, string, null, undefined, etc)
    let dateStr = '';
    if (typeof rows[0].date === 'string') {
      const match = rows[0].date.match(/^\d{4}-\d{2}-\d{2}/);
      dateStr = match ? match[0] : rows[0].date;
    } else if (rows[0].date) {
      try { dateStr = String(rows[0].date).slice(0, 10); } catch { dateStr = ''; }
    } else {
      dateStr = '';
    }
    const order = {
      ...rows[0],
      date: dateStr,
      parts: rows[0].parts ? JSON.parse(rows[0].parts) : [],
      mechanics: rows[0].mechanics ? JSON.parse(rows[0].mechanics) : [],
      extraOptions: rows[0].extraOptions ? JSON.parse(rows[0].extraOptions) : []
    };
    return order;
  } catch (error) {
    console.error('[DB] Error getting work order by ID:', error.message);
    throw error;
  }
}

// Get work order parts by work order ID
async function getWorkOrderParts(workOrderId) {
  try {
    console.log('[DB] Executing query: SELECT * FROM work_order_parts WHERE work_order_id = ?', workOrderId);
    const [rows] = await connection.execute('SELECT * FROM work_order_parts WHERE work_order_id = ?', [workOrderId]);
    console.log(`[DB] Found ${rows.length} work order parts for work order ${workOrderId}`);
    
    return rows;
  } catch (error) {
    console.error('[DB] Error getting work order parts:', error.message);
    throw error;
  }
}

// Work Order Parts functions
async function createWorkOrderPart(workOrderPart, fifoInfo = null) {
  try {
    console.log('[DB] Creating work order part:', workOrderPart);
    
    // Si tenemos información FIFO, usar el invoice link específico del lote usado
    let invoiceLink = workOrderPart.invoice_link || null;
    let invoiceNumber = workOrderPart.invoice || null;
    
    // Si tenemos información FIFO, usar los datos del lote específico
    if (fifoInfo && fifoInfo.invoicesUsed && fifoInfo.invoicesUsed.length > 0) {
      // Tomar el primer invoice usado (puede haber múltiples si se tomó de varios lotes)
      const primaryInvoice = fifoInfo.invoicesUsed[0];
      invoiceLink = primaryInvoice.invoiceLink;
      invoiceNumber = primaryInvoice.invoice;
      
      console.log(`[DB] Using FIFO invoice info: ${invoiceNumber} (${invoiceLink})`);
    } else if (!invoiceLink && workOrderPart.sku) {
      // Fallback: obtener invoice_link desde el inventario
      try {
        const [inventoryRows] = await connection.execute(
          'SELECT invoiceLink FROM inventory WHERE sku = ?',
          [workOrderPart.sku]
        );
        if (inventoryRows.length > 0 && inventoryRows[0].invoiceLink) {
          invoiceLink = inventoryRows[0].invoiceLink;
          console.log(`[DB] Found invoice link from inventory for SKU ${workOrderPart.sku}: ${invoiceLink}`);
        }
      } catch (inventoryError) {
        console.warn('[DB] Could not fetch invoice link from inventory:', inventoryError.message);
      }
    }
      // Usar los campos que existen en la tabla work_order_parts (incluyendo invoiceLink)
    const [result] = await connection.execute(
      'INSERT INTO work_order_parts (work_order_id, sku, part_name, qty_used, cost, invoiceLink) VALUES (?, ?, ?, ?, ?, ?)',
      [
        workOrderPart.work_order_id,
        workOrderPart.sku || null,
        workOrderPart.part_name || null,
        workOrderPart.qty_used || 1,
        workOrderPart.cost || 0,
        invoiceLink
      ]
    );
    
    console.log('[DB] Successfully created work order part with invoiceLink:', invoiceLink);
    return { 
      id: result.insertId, 
      ...workOrderPart, 
      invoice_link: invoiceLink,
      invoice_number: invoiceNumber,
      fifo_info: fifoInfo
    };
  } catch (error) {
    console.error('[DB] Error creating work order part:', error.message);
    throw error;
  }
}

async function updateWorkOrderPart(id, updates, fifoInfo = null) {
  try {
    console.log('[DB] Updating work order part:', id, updates);
    
    // Si tenemos información FIFO, usar el invoice link específico del lote usado
    let invoiceLink = updates.invoice_link || null;
    let invoiceNumber = updates.invoice || null;
    
    // Si tenemos información FIFO, usar los datos del lote específico
    if (fifoInfo && fifoInfo.invoicesUsed && fifoInfo.invoicesUsed.length > 0) {
      // Tomar el primer invoice usado (puede haber múltiples si se tomó de varios lotes)
      const primaryInvoice = fifoInfo.invoicesUsed[0];
      invoiceLink = primaryInvoice.invoiceLink;
      invoiceNumber = primaryInvoice.invoice;
      
      console.log(`[DB] Using FIFO invoice info for update: ${invoiceNumber} (${invoiceLink})`);
    } else if (!invoiceLink && updates.sku) {
      // Fallback: obtener invoice_link desde el inventario
      try {
        const [inventoryRows] = await connection.execute(
          'SELECT invoiceLink FROM inventory WHERE sku = ?',
          [updates.sku]
        );
        if (inventoryRows.length > 0 && inventoryRows[0].invoiceLink) {
          invoiceLink = inventoryRows[0].invoiceLink;
          console.log(`[DB] Found invoice link from inventory for SKU ${updates.sku}: ${invoiceLink}`);
        }
      } catch (inventoryError) {
        console.warn('[DB] Could not fetch invoice link from inventory:', inventoryError.message);
      }
    }

    // Actualizar los campos necesarios
    const [result] = await connection.execute(
      'UPDATE work_order_parts SET qty_used = ?, cost = ?, invoiceLink = ?, updated_at = NOW() WHERE id = ?',
      [
        updates.qty_used || 1,
        updates.cost || 0,
        invoiceLink,
        id
      ]
    );
    
    // Registrar en auditoría
    await logAuditEvent(
      updates.usuario || 'system',
      'UPDATE',
      'work_order_parts',
      id,
      {
        action: 'Work order part quantity/cost updated',
        qty_used: updates.qty_used,
        cost: updates.cost,
        invoiceLink: invoiceLink,
        fifo_info: fifoInfo
      }
    );
    
    console.log('[DB] Successfully updated work order part with invoiceLink:', invoiceLink);
    return { 
      id: id, 
      ...updates, 
      invoice_link: invoiceLink,
      invoice_number: invoiceNumber,
      fifo_info: fifoInfo,
      rowsAffected: result.affectedRows
    };
  } catch (error) {
    console.error('[DB] Error updating work order part:', error.message);
    throw error;
  }
}

async function deductInventoryFIFO(partsToDeduct, usuario = 'system') {
  try {
    console.log('[DB] Deducting inventory using FIFO for parts:', partsToDeduct);
    const result = [];
    
    for (const part of partsToDeduct) {
      let qtyNeeded = Number(part.qty) || 0;
      const originalQtyNeeded = qtyNeeded;
      const partResult = {
        sku: part.sku,
        totalQtyDeducted: 0,
        invoicesUsed: [],
        pendingPartsMarkedAsUsed: []
      };

      console.log(`[DB] FIFO: Processing ${qtyNeeded} units of ${part.sku}`);
      // PASO 1: Obtener todos los lotes PENDING disponibles para este SKU (FIFO: más antiguos primero)
      const [availableLots] = await connection.execute(`
        SELECT r.*, 
               COALESCE(r.qty, 0) as available_qty,
               r.invoice,
               r.invoiceLink,
               r.fecha as receipt_date,
               r.destino_trailer
        FROM receives r 
        WHERE r.sku = ? 
          AND r.estatus = 'PENDING'
          AND COALESCE(r.qty, 0) > 0
        ORDER BY r.fecha ASC, r.id ASC
      `, [part.sku]);

      console.log(`[DB] FIFO: Found ${availableLots.length} available PENDING lots for SKU ${part.sku}`);
      // PASO 2: Deducir de lotes PENDING usando FIFO (más antiguos primero)
      for (const lot of availableLots) {
        if (qtyNeeded <= 0) break;

        const availableInLot = Number(lot.available_qty) || 0;
        const qtyToTakeFromLot = Math.min(qtyNeeded, availableInLot);
        if (qtyToTakeFromLot > 0) {
          // SOLO cambiar estatus a USED si se agota el lote, si no, NO TOCAR NADA MÁS (NO modificar qty, invoice, etc.)
          if (qtyToTakeFromLot >= availableInLot) {
            // Cambiar estatus a USED y qty_remaining a 0
            await connection.execute(
              'UPDATE receives SET estatus = ?, qty_remaining = 0 WHERE id = ?',
              ['USED', lot.id]
            );
            // Registrar en auditoría el cambio de estado
            await logAuditEvent(
              usuario,
              'UPDATE',
              'receives',
              lot.id,
              {
                action: 'Parte pendiente marcada como USED por FIFO',
                sku: lot.sku,
                qtyUsed: qtyToTakeFromLot,
                invoice: lot.invoice,
                destinoTrailer: lot.destino_trailer,
                statusChange: { antes: 'PENDING', despues: 'USED' }
              }
            );
            partResult.pendingPartsMarkedAsUsed.push({
              id: lot.id,
              sku: lot.sku,
              qty: qtyToTakeFromLot,
              invoice: lot.invoice,
              destinoTrailer: lot.destino_trailer
            });

            // NUEVO: Si la parte estaba destinada a un trailer, y ya no quedan partes pendientes para ese trailer, limpiar alerta/campana
            if (lot.destino_trailer) {
              // Verificar si quedan partes PENDING para ese trailer
              const [pendingForTrailer] = await connection.execute(
                'SELECT COUNT(*) as count FROM receives WHERE destino_trailer = ? AND estatus = "PENDING" AND qty_remaining > 0',
                [lot.destino_trailer]
              );
              if (pendingForTrailer[0].count === 0) {
                // Limpiar alerta/campana para ese trailer (si tienes una tabla/campo de alertas, aquí deberías actualizarla)
                // Si la alerta depende solo de los receives, esto es suficiente. Si tienes una tabla de alertas, agrega aquí el UPDATE necesario.
                console.log(`[DB] Campana/alerta eliminada para trailer ${lot.destino_trailer} (ya no tiene partes pendientes)`);
                // Si tienes lógica extra para limpiar alertas, agrégala aquí.
              }
            }
          }
          // Registrar información del invoice usado (solo para trazabilidad, no modifica receives)
          partResult.invoicesUsed.push({
            invoiceId: lot.id,
            invoice: lot.invoice,
            invoiceLink: lot.invoiceLink,
            qtyTaken: qtyToTakeFromLot,
            receiptDate: lot.receipt_date,
            destinoTrailer: lot.destino_trailer,
            originalQty: availableInLot // Mantener referencia a la cantidad original
          });
          partResult.totalQtyDeducted += qtyToTakeFromLot;
          qtyNeeded -= qtyToTakeFromLot;
          // Log para depuración
          console.log(`[DB] FIFO: Took ${qtyToTakeFromLot} of ${part.sku} from lot ${lot.id} (invoice: ${lot.invoice}, status: ${qtyToTakeFromLot >= availableInLot ? 'USED' : 'PENDING'})`);
        }
      }
      // Limpieza de alertas fantasma después de cada deducción
      await cleanReceivesAlerts();
      // PASO 3: Siempre deducir del inventario master la cantidad total deducida (de PENDING o de master)
      if (partResult.totalQtyDeducted > 0) {
        const [inventoryRows] = await connection.execute(
          'SELECT onHand, salidasWo FROM inventory WHERE sku = ?',
          [part.sku]
        );
        if (inventoryRows.length > 0) {
          const currentOnHand = Number(inventoryRows[0].onHand) || 0;
          const currentSalidasWo = Number(inventoryRows[0].salidasWo) || 0;
          const newOnHand = Math.max(0, currentOnHand - partResult.totalQtyDeducted);
          const newSalidasWo = currentSalidasWo + partResult.totalQtyDeducted;
          await connection.execute(
            'UPDATE inventory SET onHand = ?, salidasWo = ? WHERE sku = ?',
            [newOnHand, newSalidasWo, part.sku]
          );
          // Registrar en auditoría la actualización del inventario master
          await logAuditEvent(
            usuario,
            'UPDATE',
            'inventory',
            part.sku,
            {
              action: 'Actualización inventario master (deducción FIFO)',
              sku: part.sku,
              qtyDeducted: partResult.totalQtyDeducted,
              onHandChange: { antes: currentOnHand, despues: newOnHand },
              salidasWoChange: { antes: currentSalidasWo, despues: newSalidasWo },
              source: 'FIFO_DEDUCTION'
            }
          );
          console.log(`[DB] FIFO: Updated master inventory for ${part.sku}: ${currentOnHand} -> ${newOnHand} (deducted ${partResult.totalQtyDeducted})`);
        }
      }
      
      // PASO 4: Si aún queda cantidad por deducir, deducir del inventario master (onHand)
      if (qtyNeeded > 0) {
        console.warn(`[DB] FIFO: No hay suficientes recibos PENDING para ${part.sku}, deduciendo ${qtyNeeded} de inventario master (onHand)`);
        // Obtener inventario actual
        const [inventoryRows] = await connection.execute(
          'SELECT onHand, salidasWo FROM inventory WHERE sku = ?',
          [part.sku]
        );
        if (inventoryRows.length > 0) {
          const currentOnHand = Number(inventoryRows[0].onHand) || 0;
          const currentSalidasWo = Number(inventoryRows[0].salidasWo) || 0;
          const newOnHand = Math.max(0, currentOnHand - qtyNeeded);
          const newSalidasWo = currentSalidasWo + qtyNeeded;
          await connection.execute(
            'UPDATE inventory SET onHand = ?, salidasWo = ? WHERE sku = ?',
            [newOnHand, newSalidasWo, part.sku]
          );
          // Registrar en auditoría la actualización del inventario master
          await logAuditEvent(
            usuario,
            'UPDATE',
            'inventory',
            part.sku,
            {
              action: 'Deducción directa de inventario master por falta de recibos PENDING',
              sku: part.sku,
              qtyDeducted: qtyNeeded,
              onHandChange: { antes: currentOnHand, despues: newOnHand },
              salidasWoChange: { antes: currentSalidasWo, despues: newSalidasWo },
              source: 'FIFO_DEDUCTION_NO_RECEIVES'
            }
          );
          partResult.totalQtyDeducted += qtyNeeded;
          qtyNeeded = 0;
        } else {
          console.error(`[DB] FIFO: No se encontró inventario master para SKU: ${part.sku}`);
          partResult.shortage = qtyNeeded;
        }
      }
      // PASO 5: Advertir si no se pudo satisfacer completamente la demanda (solo si sigue faltando después de intentar descontar de master)
      if (qtyNeeded > 0) {
        console.warn(`[DB] FIFO: Could not satisfy full demand for ${part.sku}. Missing: ${qtyNeeded} (needed: ${originalQtyNeeded}, deducted: ${partResult.totalQtyDeducted})`);
        partResult.shortage = qtyNeeded;
      }
      console.log(`[DB] FIFO: Completed processing ${part.sku}:`, {
        originalQtyNeeded,
        totalQtyDeducted: partResult.totalQtyDeducted,
        shortage: partResult.shortage || 0,
        pendingPartsUsed: partResult.pendingPartsMarkedAsUsed.length,
        invoicesUsed: partResult.invoicesUsed.length
      });
      result.push(partResult);
    }
    
    console.log('[DB] FIFO deduction completed successfully:', {
      totalPartsProcessed: result.length,
      totalPendingPartsMarkedAsUsed: result.reduce((sum, r) => sum + r.pendingPartsMarkedAsUsed.length, 0),
      totalInvoicesUsed: result.reduce((sum, r) => sum + r.invoicesUsed.length, 0)
    });
    
    // Registrar resumen de operación FIFO en auditoría
    await logAuditEvent(
      usuario,
      'FIFO_DEDUCTION',
      'inventory_system',
      null,
      {
        action: 'Deducción FIFO completada',
        totalPartsProcessed: result.length,
        pendingPartsMarkedAsUsed: result.reduce((sum, r) => sum + r.pendingPartsMarkedAsUsed.length, 0),
        invoicesUsed: result.reduce((sum, r) => sum + r.invoicesUsed.length, 0),
        partsProcessed: result.map(r => ({ sku: r.sku, qtyDeducted: r.totalQtyDeducted }))
      }
    );
    
    return { success: true, details: result };
  } catch (error) {
    console.error('[DB] Error in FIFO inventory deduction:', error.message);
    throw error;
  }
}async function deductInventory(partsToDeduct) {
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
// Partes/Inventory functions - Optimizado para memoria
async function getPartes(limit = 200, offset = 0) {
  try {
    // Validate and sanitize limit and offset to prevent SQL injection
    const safeLimit = Math.max(1, Math.min(1000, parseInt(limit) || 200));
    const safeOffset = Math.max(0, parseInt(offset) || 0);
    
    // Intentar con diferentes nombres de tabla comunes
    const tableNames = ['inventory', 'parts', 'partes', 'inventario'];
    
    for (const tableName of tableNames) {
      try {
        console.log(`[DB] Trying table: ${tableName} with limit ${safeLimit}`);
        // Use direct interpolation for LIMIT/OFFSET to avoid MySQL parameter issues
        const [rows] = await connection.execute(`SELECT * FROM ${tableName} LIMIT ${safeLimit} OFFSET ${safeOffset}`);
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

async function createParte(parte, usuario = 'SYSTEM') {
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
    
    const newParte = { id: result.insertId, ...parte };
    
    // Registrar en auditoría
    await auditInventoryOperation(usuario, 'CREATE', parte.sku, null, null, newParte);
    
    return newParte;
  } catch (error) {
    console.error('[DB] Error creating parte:', error.message);
    throw error;
  }
}

async function updateParte(id, parte, usuario = 'SYSTEM') {
  try {
    // Obtener datos actuales para auditoría
    const [current] = await connection.execute('SELECT * FROM inventory WHERE id = ?', [id]);
    const oldData = current[0] || null;
    
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
    
    const newData = { id, ...parte };
    
    // Registrar en auditoría
    await auditInventoryOperation(usuario, 'UPDATE', parte.sku, null, oldData, newData);
    
    return newData;
  } catch (error) {
    console.error('[DB] Error updating parte:', error.message);
    throw error;
  }
}

async function deleteParte(id, usuario = 'SYSTEM') {
  try {
    // Obtener datos antes de eliminar para auditoría
    const [current] = await connection.execute('SELECT * FROM inventory WHERE id = ?', [id]);
    const oldData = current[0] || null;
    
    await connection.execute('DELETE FROM inventory WHERE id=?', [id]);
    
    // Registrar en auditoría
    await auditInventoryOperation(usuario, 'DELETE', oldData?.sku || id, null, oldData, null);
  } catch (error) {
    console.error('[DB] Error deleting parte:', error.message);
    throw error;
  }
}

// Pending Parts functions
async function getReceivesParts() {
  try {
    console.log('[DB] Getting ALL parts from receives table (PENDING and USED)');
    // Devolver TODAS las partes de receives, ordenadas por fecha y estatus
    const [rows] = await connection.execute('SELECT * FROM receives ORDER BY fecha DESC, estatus ASC');
    console.log(`[DB] Found ${rows.length} total parts in receives table`);
    return rows;
  } catch (error) {
    console.error('[DB] Error getting parts from receives table:', error.message);
    throw error;
  }
}

async function createPendingPart(pendingPart) {
  try {
    console.log('[DB] Creating pending part in receives table:', pendingPart);
      // Map the fields from the frontend to the receives table structure
    const [result] = await connection.execute(
      'INSERT INTO receives (sku, category, item, provider, brand, um, destino_trailer, invoice, qty, costTax, total, totalPOClassic, fecha, estatus, invoiceLink) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        pendingPart.total || null,
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
    // Permitir actualizar cualquier campo relevante, no solo estatus
    const usuario = pendingPart.usuario || 'SYSTEM';
    // Obtener los datos actuales
    const [oldResults] = await connection.execute('SELECT * FROM receives WHERE id = ?', [id]);
    if (!oldResults || oldResults.length === 0) {
      throw new Error('Pending part not found');
    }
    const oldData = oldResults[0];

    // Normalizar totalPOClassic
    let poClassic = pendingPart.totalPOClassic;
    if (poClassic === undefined || poClassic === null || poClassic === '') {
      poClassic = pendingPart.total_po_classic || pendingPart.po_classic || oldData.totalPOClassic || '';
    }

    // Construir objeto de actualización
    const updateFields = {
      sku: pendingPart.sku !== undefined ? pendingPart.sku : oldData.sku,
      category: pendingPart.category !== undefined ? pendingPart.category : oldData.category,
      item: pendingPart.item !== undefined ? pendingPart.item : oldData.item,
      provider: pendingPart.provider !== undefined ? pendingPart.provider : oldData.provider,
      brand: pendingPart.brand !== undefined ? pendingPart.brand : oldData.brand,
      um: pendingPart.um !== undefined ? pendingPart.um : oldData.um,
      destino_trailer: pendingPart.destino_trailer !== undefined ? pendingPart.destino_trailer : oldData.destino_trailer,
      invoice: pendingPart.invoice !== undefined ? pendingPart.invoice : oldData.invoice,
      invoiceLink: pendingPart.invoiceLink !== undefined ? pendingPart.invoiceLink : oldData.invoiceLink,
      qty: pendingPart.qty !== undefined ? pendingPart.qty : oldData.qty,
      costTax: pendingPart.costTax !== undefined ? pendingPart.costTax : oldData.costTax,
      totalPOClassic: poClassic !== undefined ? poClassic : oldData.totalPOClassic,
      total: pendingPart.total !== undefined ? pendingPart.total : oldData.total,
      fecha: pendingPart.fecha !== undefined ? pendingPart.fecha : oldData.fecha,
      estatus: pendingPart.estatus !== undefined ? pendingPart.estatus : oldData.estatus,
      qty_remaining: pendingPart.qty_remaining !== undefined ? pendingPart.qty_remaining : oldData.qty_remaining
    };

    // Ejecutar el UPDATE
    await connection.execute(
      `UPDATE receives SET 
        sku=?, category=?, item=?, provider=?, brand=?, um=?, destino_trailer=?, invoice=?, invoiceLink=?, qty=?, costTax=?, totalPOClassic=?, total=?, fecha=?, estatus=?, qty_remaining=?
       WHERE id=?`,
      [
        updateFields.sku, updateFields.category, updateFields.item, updateFields.provider, updateFields.brand, updateFields.um,
        updateFields.destino_trailer, updateFields.invoice, updateFields.invoiceLink, updateFields.qty, updateFields.costTax, updateFields.totalPOClassic, updateFields.total, updateFields.fecha, updateFields.estatus, updateFields.qty_remaining, id
      ]
    );

    // Registrar en auditoría
    await logAuditEvent(
      usuario,
      'UPDATE',
      'receives',
      id,
      { action: 'Actualización de pending part', cambios: updateFields }
    );
    return { id, ...updateFields };
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
  const query = 'SELECT * FROM users';
  let attempt = 0;
  const maxAttempts = 2; // one retry on transient failure
  while (attempt < maxAttempts) {
    try {
      attempt++;
      if (attempt > 1) {
        console.log(`[DB] getUsers retry attempt ${attempt}`);
      }
      const [rows] = await connection.execute(query);
      return rows;
    } catch (error) {
      console.error('[DB] Error getting users (attempt ' + attempt + '):', error.code || error.message);
      // Retry only for transient network errors
      if (attempt < maxAttempts && ['ECONNRESET','PROTOCOL_CONNECTION_LOST','ETIMEDOUT','EPIPE'].includes(error.code)) {
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      throw error;
    }
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

// PDF functions
async function savePDFToWorkOrder(workOrderId, pdfBuffer) {
  try {
    console.log('[DB] Saving PDF to work order:', workOrderId);
    
    const query = 'UPDATE work_orders SET pdf_file = ? WHERE id = ?';
    const [result] = await connection.execute(query, [pdfBuffer, workOrderId]);
    
    console.log('[DB] PDF saved successfully to work order:', workOrderId);
    return { success: true, affectedRows: result.affectedRows };
  } catch (error) {
    console.error('[DB] Error saving PDF to work order:', error.message);
    throw error;
  }
}

// AUDIT FUNCTIONS - Sistema de Auditoría Profesional
async function logAuditEvent(usuario, accion, tabla, registroId, detalles) {
  try {
    console.log('[AUDIT] Registrando evento:', { usuario, accion, tabla, registroId });
    
    let detallesJson = typeof detalles === 'object' ? JSON.stringify(detalles) : String(detalles);
    
    // Truncar detalles si es muy largo (máximo 2000 caracteres)
    if (detallesJson.length > 2000) {
      detallesJson = detallesJson.substring(0, 1997) + '...';
      console.log('[AUDIT] Detalles truncados por longitud');
    }
    
    const [result] = await connection.execute(
      'INSERT INTO audit_log (usuario, accion, tabla, registro_id, detalles, fecha) VALUES (?, ?, ?, ?, ?, NOW())',
      [usuario || 'SYSTEM', accion, tabla, registroId, detallesJson]
    );
    
    console.log('[AUDIT] Evento registrado exitosamente con ID:', result.insertId);
    return { success: true, auditId: result.insertId };
  } catch (error) {
    console.error('[AUDIT] Error registrando evento:', error.message);
    // No lanzar error para no interrumpir la operación principal
    return { success: false, error: error.message };
  }
}

// Función para comparar objetos y generar detalles de cambios
function getChangesForAudit(oldData, newData, excludeFields = ['updated_at', 'created_at']) {
  const changes = {};
  const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  
  for (const key of allKeys) {
    if (excludeFields.includes(key)) continue;
    
    const oldValue = oldData ? oldData[key] : null;
    const newValue = newData ? newData[key] : null;
    
    // Solo registrar si hay cambio real
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = {
        antes: oldValue,
        despues: newValue
      };
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
}

// Función para formatear los cambios con nombres más amigables
function formatChangesForDisplay(changes) {
  const fieldNames = {
    'billToCo': 'Cliente',
    'trailer': 'Trailer',
    'mechanic': 'Mecánico',
    'date': 'Fecha',
    'description': 'Descripción',
    'totalHrs': 'Horas Totales',
    'totalLabAndParts': 'Costo Total',
    'status': 'Estado',
    'idClassic': 'ID Clásico',
    'numero': 'Número',
    'type': 'Tipo',
    'modelo': 'Modelo',
    'año': 'Año',
    'placa': 'Placa',
    'sku': 'SKU',
    'part': 'Parte',
    'category': 'Categoría',
    'provider': 'Proveedor',
    'brand': 'Marca',
    'onHand': 'En Stock',
    'precio': 'Precio'
  };

  const formattedChanges = {};
  for (const [key, change] of Object.entries(changes)) {
    const displayName = fieldNames[key] || key.charAt(0).toUpperCase() + key.slice(1);
    formattedChanges[displayName] = {
      antes: formatValue(change.antes),
      despues: formatValue(change.despues)
    };
  }
  
  return formattedChanges;
}

// Función para formatear valores individuales
function formatValue(value) {
  if (value === null || value === undefined) return 'Sin definir';
  if (value === '') return 'Vacío';
  if (typeof value === 'number' && value.toString().includes('.')) {
    // Si es un número decimal, formatearlo como moneda si parece ser dinero
    if (value > 1) return `$${value.toFixed(2)}`;
  }
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Función específica para auditar Work Orders
async function auditWorkOrderOperation(usuario, accion, workOrderId, details, oldData = null, newData = null) {
  let auditDetails = details;
  
  if (oldData && newData && accion === 'UPDATE') {
    const changes = getChangesForAudit(oldData, newData);
    if (changes) {
      auditDetails = {
        operation: 'Actualización de Work Order',
        workOrderId: workOrderId,
        changes: formatChangesForDisplay(changes),
        summary: `Work Order #${workOrderId} actualizada por ${usuario}`,
        cliente: newData?.billToCo || 'N/A',
        trailer: newData?.trailer || 'N/A',
        estado: newData?.status || 'N/A'
      };
    }
  } else if (accion === 'CREATE') {
    auditDetails = {
      operation: 'Creación de Work Order',
      workOrderId: workOrderId,
      summary: `Nueva Work Order #${workOrderId} creada por ${usuario}`,
      detalles: {
        cliente: newData?.billToCo || 'N/A',
        trailer: newData?.trailer || 'N/A',
        estado: newData?.status || 'En Proceso',
        costoTotal: newData?.totalLabAndParts ? `$${newData.totalLabAndParts}` : '$0',
        descripcion: newData?.description ? newData.description.substring(0, 100) + '...' : 'Sin descripción'
      }
    };
  } else if (accion === 'DELETE') {
    auditDetails = {
      operation: 'Eliminación de Work Order',
      workOrderId: workOrderId,
      summary: `Work Order #${workOrderId} eliminada por ${usuario}`,
      datosEliminados: {
        cliente: oldData?.billToCo || 'N/A',
        trailer: oldData?.trailer || 'N/A',
        estado: oldData?.status || 'N/A',
        costoTotal: oldData?.totalLabAndParts ? `$${oldData.totalLabAndParts}` : '$0'
      }
    };
  }
  
  return await logAuditEvent(usuario, accion, 'work_orders', workOrderId, auditDetails);
}

// Función específica para auditar Inventario
async function auditInventoryOperation(usuario, accion, sku, details, oldData = null, newData = null) {
  let auditDetails = details;
  
  if (oldData && newData && accion === 'UPDATE') {
    const changes = getChangesForAudit(oldData, newData);
    if (changes) {
      auditDetails = {
        operation: 'Actualización de Inventario',
        sku: sku,
        changes: formatChangesForDisplay(changes),
        summary: `Inventario SKU ${sku} actualizado por ${usuario}`,
        parte: newData?.part || oldData?.part || 'N/A',
        categoria: newData?.category || oldData?.category || 'N/A'
      };
    }
  } else if (accion === 'CREATE') {
    auditDetails = {
      operation: 'Creación de Item en Inventario',
      sku: sku,
      summary: `Nuevo item ${sku} agregado al inventario por ${usuario}`,
      detalles: {
        parte: newData?.part || 'N/A',
        categoria: newData?.category || 'N/A',
        proveedor: newData?.provider || 'N/A',
        cantidadInicial: newData?.onHand || 0,
        precio: newData?.precio ? `$${newData.precio}` : 'No definido'
      }
    };
  } else if (accion === 'DELETE') {
    auditDetails = {
      operation: 'Eliminación de Inventario',
      sku: sku,
      summary: `Item ${sku} eliminado del inventario por ${usuario}`,
      datosEliminados: {
        parte: oldData?.part || 'N/A',
        categoria: oldData?.category || 'N/A',
        cantidadAnterior: oldData?.onHand || 0,
        precio: oldData?.precio ? `$${oldData.precio}` : 'No definido'
      }
    };
  } else if (accion === 'DEDUCT') {
    auditDetails = {
      operation: 'Deducción de Inventario',
      sku: sku,
      summary: `Inventario ${sku} reducido por uso en trabajo`,
      detalles: details
    };
  }
  
  return await logAuditEvent(usuario, accion, 'inventory', sku, auditDetails);
}

// Función específica para auditar Trailers
async function auditTrailerOperation(usuario, accion, trailerId, details, oldData = null, newData = null) {
  let auditDetails = details;
  
  if (oldData && newData && accion === 'UPDATE') {
    const changes = getChangesForAudit(oldData, newData);
    if (changes) {
      auditDetails = {
        operation: 'Actualización de Trailer',
        trailerId: trailerId,
        changes: formatChangesForDisplay(changes),
        summary: `Trailer #${trailerId} actualizado por ${usuario}`,
        numero: newData?.numero || oldData?.numero || 'N/A',
        tipo: newData?.type || oldData?.type || 'N/A',
        estado: newData?.status || oldData?.status || 'N/A'
      };
    }
  } else if (accion === 'CREATE') {
    auditDetails = {
      operation: 'Creación de Trailer',
      trailerId: trailerId,
      summary: `Nuevo trailer #${trailerId} agregado por ${usuario}`,
      detalles: {
        numero: newData?.numero || 'N/A',
        tipo: newData?.type || 'N/A',
        modelo: newData?.modelo || 'N/A',
        año: newData?.año || 'N/A',
        placa: newData?.placa || 'N/A',
        estado: newData?.status || 'Disponible'
      }
    };
  } else if (accion === 'DELETE') {
    auditDetails = {
      operation: 'Eliminación de Trailer',
      trailerId: trailerId,
      summary: `Trailer #${trailerId} eliminado por ${usuario}`,
      datosEliminados: {
        numero: oldData?.numero || 'N/A',
        tipo: oldData?.type || 'N/A',
        modelo: oldData?.modelo || 'N/A',
        estado: oldData?.status || 'N/A'
      }
    };
  } else if (accion === 'RENT') {
    auditDetails = {
      operation: 'Renta de Trailer',
      trailerId: trailerId,
      summary: `Trailer #${trailerId} rentado por ${usuario}`,
      detalles: details
    };
  } else if (accion === 'RETURN') {
    auditDetails = {
      operation: 'Devolución de Trailer',
      trailerId: trailerId,
      summary: `Trailer #${trailerId} devuelto por ${usuario}`,
      detalles: details
    };
  }
  
  return await logAuditEvent(usuario, accion, 'trailers', trailerId, auditDetails);
}

async function getAuditLogs(limit = 100, offset = 0, filters = {}) {
  let query = 'SELECT * FROM audit_log';
  let params = [];
  let conditions = [];
  
  try {
    
    // Aplicar filtros
    if (filters.usuario) {
      conditions.push('usuario LIKE ?');
      params.push(`%${filters.usuario}%`);
    }
    
    if (filters.accion) {
      conditions.push('accion = ?');
      params.push(filters.accion);
    }
    
    if (filters.tabla) {
      conditions.push('tabla = ?');
      params.push(filters.tabla);
    }
    
    if (filters.fechaDesde) {
      conditions.push('fecha >= ?');
      params.push(filters.fechaDesde);
    }
    
    if (filters.fechaHasta) {
      conditions.push('fecha <= ?');
      params.push(filters.fechaHasta);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY fecha DESC';
    
    // Asegurar que limit y offset sean números válidos
    const finalLimit = Math.max(1, Math.min(1000, parseInt(limit) || 100));
    const finalOffset = Math.max(0, parseInt(offset) || 0);
    
    // Construir la query sin parámetros para LIMIT/OFFSET (MySQL puede tener problemas con parámetros en LIMIT)
    query += ` LIMIT ${finalLimit}`;
    
    if (finalOffset > 0) {
      query += ` OFFSET ${finalOffset}`;
    }
    
    console.log('[DB] Executing audit query:', query);
    console.log('[DB] With params:', params);
    
    const [rows] = await connection.execute(query, params);
    console.log(`[DB] Retrieved ${rows.length} audit logs`);
    return rows;} catch (error) {
    console.error('[DB] Error getting audit logs:', error.message);
    console.error('[DB] Query was:', query || 'undefined');
    console.error('[DB] Params were:', params || []);
    throw error;
  }
}

// Function to get all work order parts (for calculating used quantities from receive lots)
async function getAllWorkOrderParts() {
  try {
    // Simplified query - no receive_lot_id column since it doesn't exist
    const [rows] = await connection.execute(`
      SELECT 
        wop.*,
        wop.qty_used,
        wo.trailer,
        wo.date as work_order_date
      FROM work_order_parts wop
      LEFT JOIN work_orders wo ON wo.id = wop.work_order_id
      ORDER BY wo.date DESC, wop.id DESC
    `);
    return rows;
  } catch (error) {
    console.error('[DB] Error getting all work order parts:', error.message);
    throw error;
  }
}

// Función para asegurar que la tabla receives tenga la columna total
async function ensureReceivesTableStructure() {
  try {
    // Verificar si la tabla receives existe
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'receives'"
    );
    
    if (tables.length > 0) {
      // La tabla existe, verificar su estructura
      const [columns] = await connection.execute(
        "SHOW COLUMNS FROM receives"
      );
      
      const columnNames = columns.map(col => col.Field);
      console.log('[DB] Existing receives columns:', columnNames);
      
      // Verificar si la columna total existe
      if (!columnNames.includes('total')) {
        console.log('[DB] Adding missing column: total to receives table');
        await connection.execute(
          'ALTER TABLE receives ADD COLUMN total DECIMAL(10,2) DEFAULT 0.00 AFTER costTax'
        );
        console.log('[DB] Successfully added total column to receives table');
      } else {
        console.log('[DB] Column total already exists in receives table');
      }
    } else {
      console.log('[DB] receives table does not exist');
    }
    
    console.log('[DB] receives table structure verified');
  } catch (error) {
    console.error('[DB] Error ensuring receives table structure:', error.message);
  }
}

// Llamar a la función para asegurar la estructura de la tabla receives al iniciar
ensureReceivesTableStructure();

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
  getOrdersByTrailer,
  getRentalHistory,
  createOrder,
  updateOrder,
  deleteOrder,
  getOrderById,
  getWorkOrderParts,
  createWorkOrderPart,
  updateWorkOrderPart,
  updateWorkOrderPart,
  deductInventory,  deductInventoryFIFO,
  getPartes,
  createParte,
  updateParte,
  deleteParte,
  getReceivesParts,
  createPendingPart,
  updatePendingPart,
  deletePendingPart,
  getAllWorkOrderParts,
  getUsers,
  generatePDF,
  savePDFToWorkOrder,
  logAuditEvent,
  getAuditLogs,
  getChangesForAudit,
  auditWorkOrderOperation,
  auditInventoryOperation,
  auditTrailerOperation,
  getAllWorkOrderParts
};