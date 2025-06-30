const axios = require('axios');

const API_URL = process.env.REACT_APP_API_URL || 'https://graphical-system-v2.onrender.com/api';

async function testPendingPartsSystem() {
  console.log('🧪 TESTING PENDING PARTS SYSTEM - COMPLETE FLOW\n');

  try {
    // 1. Verificar trailers con partes pendientes
    console.log('📋 PASO 1: Verificar trailers con partes pendientes');
    const trailersResponse = await fetch(`${API_URL}/receive/trailers/with-pending`);
    const trailersWithPending = await trailersResponse.json();
    console.log('✅ Trailers con partes pendientes:', trailersWithPending);
    
    if (trailersWithPending.length === 0) {
      console.log('⚠️  No se encontraron trailers con partes pendientes');
      console.log('💡 Tip: Agrega partes pendientes en Receives primero');
      return;
    }

    // 2. Probar para cada trailer con partes pendientes
    for (const trailer of trailersWithPending) {
      console.log(`\n🚛 PASO 2: Obtener partes pendientes para trailer ${trailer}`);
      
      const partsResponse = await fetch(`${API_URL}/receive/pending/${encodeURIComponent(trailer)}`);
      const pendingParts = await partsResponse.json();
      
      console.log(`✅ Partes pendientes para ${trailer}:`, {
        count: pendingParts.length,
        parts: pendingParts.map(p => ({
          id: p.id,
          sku: p.sku,
          item: p.item,
          qty_remaining: p.qty_remaining,
          costTax: p.costTax
        }))
      });
    }

    console.log('\n🎯 SISTEMA FUNCIONANDO CORRECTAMENTE:');
    console.log('✅ Endpoint /receive/trailers/with-pending: OK');
    console.log('✅ Endpoint /receive/pending/:trailer: OK');
    console.log('✅ Frontend debe mostrar 🔔 en trailers con partes pendientes');
    console.log('✅ Frontend debe mostrar previsualizador al seleccionar trailer');
    
    console.log('\n📱 PARA PROBAR EN LA UI:');
    console.log('1. Ve a Work Orders → New W.O');
    console.log('2. Selecciona Bill To Co apropiado');
    console.log(`3. En la lista de trailers deberías ver: ${trailersWithPending.join(' 🔔, ')} 🔔`);
    console.log('4. Selecciona un trailer con 🔔');
    console.log('5. Debería aparecer el previsualizador de partes pendientes');
    console.log('6. Haz clic en "Add" para agregar la parte automáticamente');

  } catch (error) {
    console.error('❌ Error testing pending parts system:', error.message);
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('- Verifica que el backend esté funcionando');
    console.log('- Verifica que haya partes con estatus PENDING en receives');
    console.log('- Verifica que las partes tengan destino_trailer asignado');
  }
}

testPendingPartsSystem();
