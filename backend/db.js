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
  waitForConnections: true,
  queueLimit: 0
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

// Get work orders by trailer ID
async function getOrdersByTrailer(trailerId) {
  try {
    console.log('[DB] Executing query: SELECT * FROM work_orders WHERE trailer = ?', trailerId);
    const [rows] = await connection.execute('SELECT * FROM work_orders WHERE trailer = ?', [trailerId]);
    console.log(`[DB] Found ${rows.length} work orders for trailer ${trailerId}`);
    
    // Parse JSON fields
    const parsedRows = rows.map(row => ({
      ...row,
      parts: row.parts ? JSON.parse(row.parts) : [],
      mechanics: row.mechanics ? JSON.parse(row.mechanics) : [],
      extraOptions: row.extraOptions ? JSON.parse(row.extraOptions) : []
    }));
    
    return parsedRows;
  } catch (error) {
    console.error('[DB] Error getting work orders by trailer:', error.message);
    throw error;
  }
}

// Get rental history for a trailer
async function getRentalHistory(trailerName) {
  try {
    console.log('[DB] Executing query: SELECT * FROM rental_history WHERE trailer_name = ?', trailerName);
    const [rows] = await connection.execute('SELECT * FROM rental_history WHERE trailer_name = ? ORDER BY fecha_renta DESC', [trailerName]);
    console.log(`[DB] Found ${rows.length} rental records for trailer ${trailerName}`);
    return rows;
  } catch (error) {
    console.error('[DB] Error getting rental history:', error.message);
    // If rental_history table doesn't exist, return empty array
    return [];
  }
}

async function createOrder(order) {
  try {
    console.log('[DB] Creating order with data:', order);
    const usuario = order.usuario || 'system';
    
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
      order.status || 'PROCESSING',
      order.idClassic || null,
      JSON.stringify(order.mechanics || []),
      JSON.stringify(order.extraOptions || []),
      JSON.stringify(order.parts || [])
    ];

    const [result] = await connection.execute(
      'INSERT INTO work_orders (billToCo, trailer, mechanic, date, description, totalHrs, totalLabAndParts, status, idClassic, mechanics, extraOptions, parts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      safeValues
    );
    
    const newOrderId = result.insertId;
    console.log('[DB] Successfully created work order with ID:', newOrderId);
    
    // Registrar en auditoría
    await logAuditEvent(
      usuario,
      'CREATE',
      'work_orders',
      newOrderId,
      {
        action: 'Nueva Work Order creada',
        customer: order.billToCo,
        trailer: order.trailer,
        mechanic: order.mechanic,
        totalCost: order.totalLabAndParts,
        partsCount: order.parts?.length || 0
      }
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
      id
    ];    const [result] = await connection.execute(
      'UPDATE work_orders SET billToCo = ?, trailer = ?, mechanic = ?, date = ?, description = ?, totalHrs = ?, totalLabAndParts = ?, status = ?, idClassic = ?, mechanics = ?, extraOptions = ?, parts = ? WHERE id = ?',
      safeValues
    );
    
    console.log('[DB] Successfully updated work order with ID:', id);
    
    // NUEVA FUNCIONALIDAD: Sincronizar partes con work_order_parts cuando se edita
    if (order.parts && Array.isArray(order.parts) && order.parts.length > 0) {
      console.log('[DB] Syncing parts to work_order_parts table for work order:', id);
      
      // Primero, eliminar partes existentes para esta work order
      await connection.execute('DELETE FROM work_order_parts WHERE work_order_id = ?', [id]);
      
      // Luego, insertar las partes actuales
      for (const part of order.parts) {
        if (part.sku && part.sku.trim() !== '') {
          await connection.execute(
            'INSERT INTO work_order_parts (work_order_id, sku, part_name, qty_used, cost, usuario) VALUES (?, ?, ?, ?, ?, ?)',
            [
              id,
              part.sku,
              part.part || '',
              Number(part.qty) || 0,
              Number(part.cost) || 0,
              usuario || ''
            ]
          );
          console.log(`[DB] Synced part ${part.sku} to work_order_parts`);
        }
      }
    }
    
    // Registrar cambios en auditoría
    const changes = getChangesForAudit(currentData, {
      billToCo: order.billToCo,
      trailer: order.trailer,
      mechanic: order.mechanic,
      date: order.date,
      description: order.description,
      totalHrs: order.totalHrs,
      totalLabAndParts: order.totalLabAndParts,
      status: order.status,
      idClassic: order.idClassic
    });
    
    if (Object.keys(changes).length > 0) {
      await logAuditEvent(
        usuario,
        'UPDATE',
        'work_orders',
        id,
        {
          action: 'Work Order actualizada',
          changes: changes
        }
      );
    }
    
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
    
    // Parse JSON fields
    const order = {
      ...rows[0],
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
          // Calcular nueva cantidad en el lote
          const newQtyInLot = availableInLot - qtyToTakeFromLot;
          const newStatus = newQtyInLot <= 0 ? 'USED' : 'PENDING';
          
          // Actualizar el lote en receives
          await connection.execute(
            'UPDATE receives SET qty = ?, estatus = ? WHERE id = ?',
            [newQtyInLot, newStatus, lot.id]
          );
          
          // Registrar información del invoice usado
          partResult.invoicesUsed.push({
            invoiceId: lot.id,
            invoice: lot.invoice,
            invoiceLink: lot.invoiceLink,
            qtyTaken: qtyToTakeFromLot,
            receiptDate: lot.receipt_date,
            destinoTrailer: lot.destino_trailer
          });
          
          // Si se marcó como USED, registrarlo
          if (newStatus === 'USED') {
            partResult.pendingPartsMarkedAsUsed.push({
              id: lot.id,
              sku: lot.sku,
              qty: qtyToTakeFromLot,
              invoice: lot.invoice,
              destinoTrailer: lot.destino_trailer
            });
            
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
          }
          
          partResult.totalQtyDeducted += qtyToTakeFromLot;
          qtyNeeded -= qtyToTakeFromLot;
          
          console.log(`[DB] FIFO: Took ${qtyToTakeFromLot} of ${part.sku} from lot ${lot.id} (invoice: ${lot.invoice}, remaining: ${newQtyInLot}, status: ${newStatus})`);
        }
      }      
      // PASO 3: Si aún se necesita más cantidad, deducir del inventario master (stock sin destino específico)
      if (qtyNeeded > 0) {
        console.log(`[DB] FIFO: ${qtyNeeded} units of ${part.sku} not found in PENDING lots, deducting from master inventory`);
        
        const [inventoryRows] = await connection.execute(
          'SELECT onHand, salidasWo FROM inventory WHERE sku = ?',
          [part.sku]
        );
        
        if (inventoryRows.length > 0) {
          const currentOnHand = Number(inventoryRows[0].onHand) || 0;
          const currentSalidasWo = Number(inventoryRows[0].salidasWo) || 0;
          const qtyToDeductFromMaster = Math.min(qtyNeeded, currentOnHand);
          
          if (qtyToDeductFromMaster > 0) {
            const newOnHand = currentOnHand - qtyToDeductFromMaster;
            const newSalidasWo = currentSalidasWo + qtyToDeductFromMaster;
            
            await connection.execute(
              'UPDATE inventory SET onHand = ?, salidasWo = ? WHERE sku = ?',
              [newOnHand, newSalidasWo, part.sku]
            );
            
            // Registrar en auditoría la deducción del inventario master
            await logAuditEvent(
              usuario,
              'UPDATE',
              'inventory',
              part.sku,
              {
                action: 'Deducción de inventario master por FIFO',
                sku: part.sku,
                qtyDeducted: qtyToDeductFromMaster,
                onHandChange: { antes: currentOnHand, despues: newOnHand },
                salidasWoChange: { antes: currentSalidasWo, despues: newSalidasWo }
              }
            );
            
            partResult.totalQtyDeducted += qtyToDeductFromMaster;
            qtyNeeded -= qtyToDeductFromMaster;
            
            console.log(`[DB] FIFO: Deducted ${qtyToDeductFromMaster} of ${part.sku} from master inventory: ${currentOnHand} -> ${newOnHand}`);
          }
        }
      }
      
      // PASO 4: SIEMPRE actualizar el inventario master para reflejar la deducción total
      // Esto es necesario porque el inventario master debe reflejar TODO el stock disponible
      if (partResult.totalQtyDeducted > 0) {
        const [inventoryRows] = await connection.execute(
          'SELECT onHand, salidasWo FROM inventory WHERE sku = ?',
          [part.sku]
        );
        
        if (inventoryRows.length > 0) {
          const currentOnHand = Number(inventoryRows[0].onHand) || 0;
          const currentSalidasWo = Number(inventoryRows[0].salidasWo) || 0;
          
          // Solo actualizar si no se actualizó en el paso anterior
          if (qtyNeeded === 0 && originalQtyNeeded > 0) {
            // Se dedujo todo de lotes PENDING, actualizar inventario master
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
                action: 'Actualización inventario master (deducción desde PENDING)',
                sku: part.sku,
                qtyDeducted: partResult.totalQtyDeducted,
                onHandChange: { antes: currentOnHand, despues: newOnHand },
                salidasWoChange: { antes: currentSalidasWo, despues: newSalidasWo },
                source: 'PENDING_LOTS'
              }
            );
            
            console.log(`[DB] FIFO: Updated master inventory for ${part.sku}: ${currentOnHand} -> ${newOnHand} (all from PENDING lots)`);
          }
        }
      }
      
      // PASO 5: Advertir si no se pudo satisfacer completamente la demanda
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

// AUDIT FUNCTIONS
async function logAuditEvent(usuario, accion, tabla, registroId, detalles, ipAddress = null) {
  try {
    console.log('[DB] Logging audit event:', { usuario, accion, tabla, registroId });
    
    let detallesJson = typeof detalles === 'object' ? JSON.stringify(detalles) : String(detalles);
    
    // Truncar detalles si es muy largo (máximo 1000 caracteres para evitar error SQL)
    if (detallesJson.length > 1000) {
      detallesJson = detallesJson.substring(0, 997) + '...';
      console.log('[DB] Detalles truncados por ser muy largos');
    }
    
    const [result] = await connection.execute(
      'INSERT INTO audit_log (usuario, accion, tabla, registro_id, detalles, fecha) VALUES (?, ?, ?, ?, ?, NOW())',
      [usuario, accion, tabla, registroId, detallesJson]
    );
    
    console.log('[DB] Audit event logged successfully with ID:', result.insertId);
    return { success: true, auditId: result.insertId };
  } catch (error) {
    console.error('[DB] Error logging audit event:', error.message);
    // No lanzar error para no interrumpir la operación principal
    return { success: false, error: error.message };
  }
}

async function getAuditLogs(limit = 100, offset = 0, filters = {}) {
  try {
    let query = 'SELECT * FROM audit_log';
    let params = [];
    let conditions = [];
    
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
      query += ' ORDER BY fecha DESC LIMIT ? OFFSET ?';
    params.push(Number(limit) || 100, Number(offset) || 0);
    
    const [rows] = await connection.execute(query, params);
    console.log(`[DB] Retrieved ${rows.length} audit logs`);
    return rows;
  } catch (error) {
    console.error('[DB] Error getting audit logs:', error.message);
    throw error;
  }
}

// Helper function to track changes between old and new data
function getChangesForAudit(oldData, newData, excludeFields = ['fecha_modificacion', 'updated_at']) {
  const changes = {};
  
  // Comparar todos los campos
  const allFields = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  
  for (const field of allFields) {
    if (excludeFields.includes(field)) continue;
    
    const oldValue = oldData?.[field];
    const newValue = newData?.[field];
    
    // Comparar valores, considerando null/undefined como equivalentes
    const oldNormalized = oldValue === null || oldValue === undefined ? '' : String(oldValue);
    const newNormalized = newValue === null || newValue === undefined ? '' : String(newValue);
    
    if (oldNormalized !== newNormalized) {
      changes[field] = {
        antes: oldValue,
        despues: newValue
      };
    }
  }
  
  return changes;
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
  getOrdersByTrailer,
  getRentalHistory,
  createOrder,
  updateOrder,
  deleteOrder,
  getOrderById,
  getWorkOrderParts,
  createWorkOrderPart,
  deductInventory,
  deductInventoryFIFO,
  getPartes,
  createParte,
  updateParte,
  deleteParte,
  getReceivesParts,
  createPendingPart,
  updatePendingPart,
  deletePendingPart,
  getUsers,
  generatePDF,
  savePDFToWorkOrder,
  logAuditEvent,
  getAuditLogs,
  getChangesForAudit
};