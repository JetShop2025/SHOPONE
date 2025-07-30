// FUNCIÓN POST OPTIMIZADA PARA VELOCIDAD
router.post('/', async (req, res) => {
  try {
    const fields = req.body;
    const parts = fields.parts || [];
    const extraOptions = fields.extraOptions || [];
    const billToCo = fields.billToCo || '';
    const trailer = fields.trailer || '';
    const mechanic = fields.mechanic || '';
    const mechanicsArr = Array.isArray(fields.mechanics) ? fields.mechanics : [];
    const date = fields.date || new Date();
    const description = fields.description || '';
    const status = fields.status || 'PENDING';
    const idClassic = fields.idClassic || null;

    // Limpia y valida partes
    const partsArr = Array.isArray(parts)
      ? parts
          .filter(part => part.sku && String(part.sku).trim() !== '')
          .map(part => ({
            ...part,
            cost: Number(String(part.cost).replace(/[^0-9.]/g, '')),
            qty: Number(part.qty) || 0
          }))
      : [];

    // Calcula totales
    let totalHrsPut = 0;
    if (Array.isArray(fields.mechanics) && fields.mechanics.length > 0) {
      totalHrsPut = fields.mechanics.reduce((sum, m) => sum + (parseFloat(m.hrs) || 0), 0);
    }
    if (!totalHrsPut && fields.totalHrs) {
      totalHrsPut = parseFloat(fields.totalHrs) || 0;
    }
    const laborTotal = totalHrsPut * 60;
    const partsTotal = partsArr.reduce((sum, part) => sum + (Number(part.cost) || 0), 0);
    const subtotal = partsTotal + laborTotal;

    let extra = 0;
    let extraLabels = [];
    let extraArr = [];
    const extras = Array.isArray(extraOptions) ? extraOptions : [];
    
    // SIEMPRE aplicar 5% automático
    extra += subtotal * 0.05;
    extraLabels.push('5% Emergency');
    extraArr.push(subtotal * 0.05);
    
    extras.forEach(opt => {
      if (opt === '15shop') {
        extraLabels.push('15% Shop Miscellaneous');
        extraArr.push(subtotal * 0.15);
        extra += subtotal * 0.15;
      }
      if (opt === '15weld') {
        extraLabels.push('15% Welding Supplies');
        extraArr.push(subtotal * 0.15);
        extra += subtotal * 0.15;
      }
    });

    // Calcula el total final
    let totalLabAndPartsFinal;
    if (
      fields.totalLabAndParts !== undefined &&
      fields.totalLabAndParts !== null &&
      fields.totalLabAndParts !== '' &&
      !isNaN(Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, '')))
    ) {
      // Respeta el valor manual del usuario
      totalLabAndPartsFinal = Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, ''));
    } else {
      // Usa el cálculo automático
      totalLabAndPartsFinal = subtotal + extra;
    }

    // **PASO 1: INSERTAR EN DB - RÁPIDO**
    const query = `
      INSERT INTO work_orders (billToCo, trailer, mechanic, mechanics, date, description, parts, totalHrs, totalLabAndParts, status, idClassic, extraOptions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      billToCo, trailer, mechanic, JSON.stringify(mechanicsArr), date, description,
      JSON.stringify(partsArr), totalHrsPut, totalLabAndPartsFinal, status, idClassic,
      JSON.stringify(extraOptions || [])
    ];
    const [result] = await db.query(query, values);
    const id = result.insertId;

    // **PASO 2: RESPONDER INMEDIATAMENTE - VELOCIDAD**
    const formattedDate = typeof date === 'string' && date.includes('-') 
      ? (() => { const [yyyy, mm, dd] = date.split('-'); return `${mm}-${dd}-${yyyy}`; })()
      : (date.toISOString ? date.toISOString().slice(0, 10) : '');
    
    const response = {
      id: id,
      message: 'Work Order created successfully',
      pdfUrl: `/pdfs/${formattedDate}_${fields.idClassic || id}.pdf`
    };
    
    res.status(201).json(response);

    // **PASO 3: PROCESOS PESADOS EN BACKGROUND - NO BLOQUEA**
    setImmediate(async () => {
      try {
        await Promise.all([
          // Inventario en paralelo
          (async () => {
            if (partsArr.length === 0) return;
            
            try {
              const skus = partsArr.map(p => p.sku).filter(Boolean);
              if (skus.length === 0) return;
              
              const [inventoryResults] = await db.query(
                'SELECT sku, onHand FROM inventory WHERE sku IN (?)',
                [skus]
              );
              
              const inventoryMap = {};
              inventoryResults.forEach(item => {
                inventoryMap[item.sku] = item.onHand;
              });
              
              const updates = [];
              const logs = [];
              
              for (const part of partsArr) {
                if (part.sku && part.qty && Number(part.qty) > 0) {
                  const requestedQty = Number(part.qty);
                  const available = inventoryMap[part.sku] || 0;
                  let toDeductFromInventory = 0;
                  if (available >= requestedQty) {
                    // All can be deducted from inventory
                    toDeductFromInventory = requestedQty;
                  } else if (available > 0) {
                    // Partially deduct from inventory, rest from master
                    toDeductFromInventory = available;
                  }
                  if (toDeductFromInventory > 0) {
                    updates.push([toDeductFromInventory, toDeductFromInventory, part.sku]);
                    logs.push({ sku: part.sku, qty: toDeductFromInventory, wo: id });
                  }
                  // Deduct missing qty from master inventory if needed
                  const missingQty = requestedQty - toDeductFromInventory;
                  if (missingQty > 0) {
                    // Deduct from master inventory (onHand)
                    await db.query(
                      'UPDATE inventory SET onHand = onHand - ? WHERE sku = ?',
                      [missingQty, part.sku]
                    );
                    if (typeof logAccion === 'function') {
                      await logAccion(fields.usuario || 'system', 'DEDUCT_MASTER', 'inventory', part.sku, JSON.stringify({ qty: missingQty, wo: id }));
                    }
                  }
                }
              }
              
              if (updates.length > 0) {
                await Promise.all(
                  updates.map(update => 
                    db.query(
                      'UPDATE inventory SET onHand = onHand - ?, salidasWo = salidasWo + ? WHERE sku = ?',
                      update
                    )
                  )
                );
                
                if (typeof logAccion === 'function') {
                  await Promise.all(
                    logs.map(log => 
                      logAccion(fields.usuario || 'system', 'DEDUCT', 'inventory', log.sku, JSON.stringify({ qty: log.qty, wo: log.wo }))
                    )
                  );
                }
              }
            } catch (err) {
              console.error('ERROR INVENTARIO (async):', err);
            }
          })(),
          
          // Work order parts en paralelo
          (async () => {
            if (partsArr.length === 0) return;
            
            try {
              const workOrderPartsPromises = partsArr.map(part => 
                db.query(
                  'INSERT INTO work_order_parts (work_order_id, sku, part_name, qty_used, cost, usuario) VALUES (?, ?, ?, ?, ?, ?)',
                  [id, part.sku, part.part || '', part.qty, Number(String(part.cost).replace(/[^0-9.]/g, '')), fields.usuario || 'system']
                )
              );
              
              await Promise.all(workOrderPartsPromises);
            } catch (err) {
              console.error('ERROR WORK ORDER PARTS (async):', err);
            }
          })(),
          
          // PDF en paralelo - OPTIMIZADO
          (async () => {
            try {
              const pdfName = `${formattedDate}_${fields.idClassic || id}.pdf`;
              const pdfPath = path.join(__dirname, '../pdfs', pdfName);

              const doc = new PDFDocument({ margin: 40, size: 'A4' });
              const stream = fs.createWriteStream(pdfPath);
              doc.pipe(stream);

              // Header rápido
              doc.font('Courier-Bold').fontSize(24).fillColor('#1976d2').text('INVOICE', { align: 'center' });
              doc.font('Courier').fontSize(10).fillColor('#333').text('JET SHOP, LLC.', 400, 40, { align: 'right' });
              doc.text('740 EL CAMINO REAL', { align: 'right' });
              doc.text('GREENFIELD, CA 93927', { align: 'right' });

              // Info básica
              doc.font('Courier-Bold').fontSize(10).fillColor('#1976d2');
              doc.text('Bill To Co:', 40, 120);
              doc.text('Trailer:', 40, 140);
              doc.text('Date:', 40, 160);
              doc.text('Mechanic:', 400, 140);
              doc.text('ID CLASSIC:', 400, 160);

              doc.font('Courier').fontSize(10).fillColor('#222');
              doc.text(billToCo || '-', 120, 120);
              doc.text(trailer || '-', 120, 140);
              doc.text(formattedDate || '-', 120, 160);
              
              const mechanicToShow = Array.isArray(mechanicsArr) && mechanicsArr.length > 0
                ? mechanicsArr.map(m => m.name).join(', ')
                : mechanic;
              doc.text(mechanicToShow || '-', 480, 140);
              doc.text(idClassic || '-', 480, 160);

              // Descripción
              doc.font('Courier-Bold').fontSize(11).fillColor('#1976d2');
              doc.text('Description:', 50, 200);
              doc.font('Courier').fontSize(11).fillColor('#222');
              doc.text(description || '', 50, 216, { width: 500 });

              let y = 260;
              
              // Tabla simplificada para velocidad
              if (partsArr.length > 0) {
                doc.font('Courier-Bold').fontSize(10).fillColor('#1976d2');
                doc.text('SKU', 50, y);
                doc.text('PART', 150, y);
                doc.text('QTY', 300, y);
                doc.text('COST', 350, y);
                doc.text('TOTAL', 450, y);
                y += 20;
                
                doc.font('Courier').fontSize(9).fillColor('#222');
                partsArr.forEach((p, i) => {
                  doc.text(p.sku || '-', 50, y);
                  doc.text(p.part || '-', 150, y);
                  doc.text(p.qty || '-', 300, y);
                  doc.text(`$${(p.cost || 0).toFixed(2)}`, 350, y);
                  doc.text(`$${((p.qty || 0) * (p.cost || 0)).toFixed(2)}`, 450, y);
                  y += 18;
                });
              }



              // === RESUMEN FINANCIERO: Miscellaneous y Welding Supplies SIEMPRE visibles ===
              y += 20;
              // Log para depuración de porcentajes y montos
              console.error(`[PDF-OPT] miscPercent:`, fields.miscellaneousPercent, '->', (typeof fields.miscellaneousPercent), '| weldPercent:', fields.weldPercent, '->', (typeof fields.weldPercent));
              const miscPercent = (typeof fields.miscellaneousPercent !== 'undefined' && fields.miscellaneousPercent !== null && fields.miscellaneousPercent !== '') ? Number(fields.miscellaneousPercent) : 0;
              const weldPercent = (typeof fields.weldPercent !== 'undefined' && fields.weldPercent !== null && fields.weldPercent !== '') ? Number(fields.weldPercent) : 0;
              const miscAmount = subtotal * (miscPercent / 100);
              const weldAmount = subtotal * (weldPercent / 100);

              doc.font('Courier-Bold').fontSize(10).fillColor('#1976d2');
              doc.text(`Miscellaneous ${miscPercent}%: $${miscAmount.toFixed(2)}`, 350, y);
              y += 18;
              doc.text(`Welding Supplies ${weldPercent}%: $${weldAmount.toFixed(2)}`, 350, y);
              y += 18;

              // TOTAL
              doc.font('Courier-Bold').fontSize(12).fillColor('#d32f2f');
              doc.text(`TOTAL: $${totalLabAndPartsFinal.toFixed(2)}`, 350, y);

              doc.end();
            } catch (err) {
              console.error('ERROR PDF (async):', err);
            }
          })()
        ]);
        
        // Log final
        if (typeof logAccion === 'function') {
          await logAccion(fields.usuario || 'system', 'CREATE', 'work_orders', id, JSON.stringify({ billToCo, trailer }));
        }
      } catch (err) {
        console.error('Error en background:', err);
      }
    });

  } catch (err) {
    console.error('Error creando WO:', err);
    res.status(500).json({ error: 'Error al crear la orden de trabajo' });
  }
});
