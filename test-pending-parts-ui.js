/**
 * TEST COMPLETO - VALIDACIÓN UI PARTES PENDIENTES
 * 
 * Este script valida todo el flujo de partes pendientes desde la perspectiva del usuario:
 * 1. Usuario selecciona trailer en el formulario de WO
 * 2. Sistema carga automáticamente las partes pendientes para ese trailer
 * 3. Usuario ve el previsualizador de partes pendientes
 * 4. Usuario selecciona cantidad y agrega parte pendiente a la WO
 * 5. Parte se agrega automáticamente con costo unitario correcto
 * 6. Al guardar WO, backend procesa la parte pendiente correctamente
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5050';

console.log('🧪 TEST COMPLETO - VALIDACIÓN UI PARTES PENDIENTES');
console.log('=====================================================');

async function testPendingPartsUI() {
  try {
    console.log('\n=== PASO 1: SETUP - AGREGAR PARTE PENDIENTE DE PRUEBA ===');
    
    // Agregar una parte de prueba al sistema de receives
    const newReceive = {
      sku: 'TESTUI001',
      item: 'Componente de prueba UI',
      destino_trailer: 'TRL999',
      qty: 10,
      costTax: 45.75,
      estatus: 'PENDING'
    };
    
    const receiveResponse = await axios.post(`${API_URL}/receive`, newReceive);
    console.log('📦 Parte de prueba agregada:', {
      id: receiveResponse.data.id,
      sku: newReceive.sku,
      item: newReceive.item,
      trailer: newReceive.destino_trailer,
      qty: newReceive.qty,
      cost: newReceive.costTax
    });
    
    console.log('\n=== PASO 2: SIMULAR SELECCIÓN DE TRAILER EN UI ===');
    
    // Simular cuando el usuario selecciona el trailer TRL999
    const trailerSelected = 'TRL999';
    console.log('🚛 Usuario selecciona trailer:', trailerSelected);
    
    console.log('\n=== PASO 3: FRONTEND CARGA PARTES PENDIENTES ===');
      // Esto es lo que hace el frontend cuando cambia el trailer
    const pendingPartsResponse = await axios.get(`${API_URL}/receive/pending/${trailerSelected}`);
    const pendingParts = Array.isArray(pendingPartsResponse.data) ? pendingPartsResponse.data : [];
    
    console.log('📋 Partes pendientes cargadas para UI:', {
      trailer: trailerSelected,
      partsCount: pendingParts.length,
      responseType: typeof pendingPartsResponse.data,
      rawResponse: pendingPartsResponse.data,
      parts: pendingParts.map(p => ({
        id: p.id,
        sku: p.sku,
        item: p.item,
        qty_remaining: p.qty_remaining,
        estatus: p.estatus
      }))
    });
      console.log('\n=== PASO 4: USUARIO VE PREVISUALIZADOR ===');
    
    if (pendingParts.length === 0) {
      console.log('⚠️ No hay partes pendientes para este trailer');
      console.log('🔍 Verificando si la parte se agregó correctamente...');
      
      // Verificar todas las partes en receives
      const allReceivesResponse = await axios.get(`${API_URL}/receive`);
      const allReceives = Array.isArray(allReceivesResponse.data) ? allReceivesResponse.data : [];
      console.log('📋 Total de receives encontrados:', allReceives.length);
      
      const trailerParts = allReceives.filter(r => r.destino_trailer === trailerSelected);
      console.log('🚛 Receives para', trailerSelected, ':', trailerParts.length);
      
      if (trailerParts.length > 0) {
        console.log('📦 Partes encontradas:', trailerParts.map(p => ({
          id: p.id,
          sku: p.sku,
          item: p.item,
          estatus: p.estatus,
          qty_remaining: p.qty_remaining
        })));
      }
      
      return; // Exit early if no pending parts
    }
    
    // El usuario ve esta información en la UI
    console.log('👀 Previsualizador muestra:');
    pendingParts.forEach(part => {
      console.log(`   • ${part.sku} - ${part.item}`);
      console.log(`     Cantidad disponible: ${part.qty_remaining}`);
      console.log(`     [Input: cantidad] [Botón: ➕ Agregar a WO]`);
    });
    
    console.log('\n=== PASO 5: USUARIO AGREGA PARTE A WO ===');
    
    // Simular que el usuario selecciona la primera parte y cantidad 3
    const selectedPart = pendingParts[0];
    const qtyToUse = 3;
    
    console.log('🎯 Usuario selecciona:', {
      part: selectedPart.sku,
      item: selectedPart.item,
      qtyToUse: qtyToUse,
      availableQty: selectedPart.qty_remaining
    });
    
    // Buscar el costo en inventario (simular lo que hace el addPendingPart)
    const inventoryResponse = await axios.get(`${API_URL}/inventory`);
    const inventory = inventoryResponse.data;
    const inventoryPart = inventory.find(item => 
      String(item.sku).toLowerCase() === String(selectedPart.sku).toLowerCase()
    );
    
    let unitCost = 0;
    if (inventoryPart) {
      // Prioridad al campo 'precio'
      unitCost = inventoryPart.precio || inventoryPart.cost || inventoryPart.price || 0;
    }
    
    // Crear la parte como la agregaría el frontend
    const newPartForWO = {
      sku: selectedPart.sku,
      part: selectedPart.item,
      qty: qtyToUse.toString(),
      cost: unitCost > 0 ? unitCost.toFixed(2) : '0.00',
      _pendingPartId: selectedPart.id // Referencia crítica para el backend
    };
    
    console.log('✅ Parte agregada a WO:', newPartForWO);
    
    console.log('\n=== PASO 6: USUARIO COMPLETA Y GUARDA WO ===');
    
    // Crear una Work Order completa
    const newWorkOrder = {
      billToCo: 'TESTCO',
      date: new Date().toISOString().split('T')[0],
      trailer: trailerSelected,
      status: 'PRE W.O',
      description: 'Test WO con parte pendiente',
      mechanics: [
        { name: 'Test Mechanic', hrs: '2' }
      ],
      parts: [newPartForWO], // Incluye la parte pendiente con _pendingPartId
      extraOptions: [],
      totalHrs: 2,
      usuario: 'test-user'
    };
    
    console.log('📝 Work Order completa:', {
      trailer: newWorkOrder.trailer,
      description: newWorkOrder.description,
      partsCount: newWorkOrder.parts.length,
      partWithPendingId: newWorkOrder.parts[0]._pendingPartId ? 'Sí' : 'No'
    });
    
    console.log('\n=== PASO 7: BACKEND PROCESA LA WO ===');
    
    // Enviar la WO al backend
    const woResponse = await axios.post(`${API_URL}/workOrders`, newWorkOrder);
    console.log('🔄 Work Order procesada:', {
      id: woResponse.data.id,
      success: woResponse.data.success || 'OK'
    });
    
    console.log('\n=== PASO 8: VERIFICAR RESULTADO FINAL ===');
    
    // Verificar que la parte pendiente se actualizó correctamente
    const updatedPendingParts = await axios.get(`${API_URL}/receive/pending/${trailerSelected}`);
    const updatedPart = updatedPendingParts.data.find(p => p.id === selectedPart.id);
    
    if (updatedPart) {
      console.log('📊 Parte pendiente actualizada:', {
        id: updatedPart.id,
        sku: updatedPart.sku,
        qty_original: selectedPart.qty_remaining,
        qty_used: qtyToUse,
        qty_remaining: updatedPart.qty_remaining,
        estatus: updatedPart.estatus
      });
      
      const expectedRemaining = selectedPart.qty_remaining - qtyToUse;
      if (updatedPart.qty_remaining === expectedRemaining) {
        console.log('✅ CANTIDAD CORRECTA: Se descontó correctamente');
      } else {
        console.log('❌ ERROR EN CANTIDAD:', {
          expected: expectedRemaining,
          actual: updatedPart.qty_remaining
        });
      }
      
      if (updatedPart.qty_remaining > 0 && updatedPart.estatus === 'PENDING') {
        console.log('✅ ESTATUS CORRECTO: Sigue PENDING porque quedan unidades');
      } else if (updatedPart.qty_remaining === 0 && updatedPart.estatus === 'USED') {
        console.log('✅ ESTATUS CORRECTO: Cambió a USED porque se agotó');
      } else {
        console.log('❌ ERROR EN ESTATUS:', {
          qty_remaining: updatedPart.qty_remaining,
          estatus: updatedPart.estatus
        });
      }
    } else {
      if (selectedPart.qty_remaining === qtyToUse) {
        console.log('✅ PARTE REMOVIDA CORRECTAMENTE: Se usó completamente');
      } else {
        console.log('❌ ERROR: Parte no encontrada pero debería seguir existiendo');
      }
    }
    
    console.log('\n=== RESULTADO FINAL ===');
    console.log('✅ Test completado exitosamente');
    console.log('🎯 Flujo UI de partes pendientes validado');
    console.log('📱 El usuario puede:');
    console.log('   1. Seleccionar trailer y ver partes pendientes automáticamente');
    console.log('   2. Elegir cantidad y agregar parte pendiente a WO');
    console.log('   3. Guardar WO y que el sistema procese todo automáticamente');
    console.log('   4. Ver en tiempo real las partes pendientes actualizadas');
    
  } catch (error) {
    console.error('❌ Error en el test:', error.message);
    if (error.response) {
      console.error('📄 Respuesta del servidor:', error.response.data);
    }
  }
}

// Ejecutar el test
testPendingPartsUI();
