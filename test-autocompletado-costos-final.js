const axios = require('axios');

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';

async function testAutocompletadoCostos() {
  console.log('🧪 TESTING AUTOCOMPLETADO DE COSTOS UNITARIOS\n');

  try {
    // 1. Verificar inventario y sus campos de precio
    console.log('📋 PASO 1: Verificar inventario y campos de precio');
    const inventoryResponse = await axios.get(`${API_URL}/inventory`);
    const inventory = inventoryResponse.data;
    
    console.log('✅ Total items en inventario:', inventory.length);
    
    if (inventory.length === 0) {
      console.log('❌ No hay items en el inventario');
      return;
    }
    
    // Analizar campos de precio
    const withPrecio = inventory.filter(item => item.precio).length;
    const withCost = inventory.filter(item => item.cost).length;
    const withPrice = inventory.filter(item => item.price).length;
    
    console.log('💰 Análisis de campos de precio:');
    console.log(`  - Items con campo "precio": ${withPrecio}/${inventory.length}`);
    console.log(`  - Items con campo "cost": ${withCost}/${inventory.length}`);
    console.log(`  - Items con campo "price": ${withPrice}/${inventory.length}`);
    
    // Mostrar primeros 3 items como ejemplo
    console.log('\n📊 Primeros 3 items del inventario:');
    inventory.slice(0, 3).forEach((item, idx) => {
      console.log(`  ${idx + 1}. SKU: ${item.sku}`);
      console.log(`     Parte: ${item.part || item.description || 'N/A'}`);
      console.log(`     Precio: ${item.precio || 'N/A'}`);
      console.log(`     Cost: ${item.cost || 'N/A'}`);
      console.log(`     Price: ${item.price || 'N/A'}`);
      console.log('');
    });

    // 2. Verificar partes pendientes
    console.log('🚛 PASO 2: Verificar partes pendientes');
    const trailersResponse = await axios.get(`${API_URL}/receive/trailers/with-pending`);
    const trailersWithPending = trailersResponse.data;
    
    console.log('✅ Trailers con partes pendientes:', trailersWithPending);
    
    if (trailersWithPending.length > 0) {
      const trailer = trailersWithPending[0];
      console.log(`\n🔍 Verificando partes pendientes para trailer: ${trailer}`);
      
      const partsResponse = await axios.get(`${API_URL}/receive/pending/${encodeURIComponent(trailer)}`);
      const pendingParts = partsResponse.data;
      
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
      
      // 3. Simular autocompletado
      if (pendingParts.length > 0) {
        const testPart = pendingParts[0];
        console.log(`\n🔧 PASO 3: Simular autocompletado para SKU: ${testPart.sku}`);
        
        // Buscar en inventario
        const inventoryPart = inventory.find(item => 
          String(item.sku).toLowerCase() === String(testPart.sku).toLowerCase()
        );
        
        if (inventoryPart) {
          console.log('✅ Parte encontrada en inventario:', {
            sku: inventoryPart.sku,
            part: inventoryPart.part || inventoryPart.description,
            precio: inventoryPart.precio,
            cost: inventoryPart.cost,
            price: inventoryPart.price
          });
          
          // Aplicar lógica de prioridad
          let finalCost = 0;
          let usedField = '';
          
          if (inventoryPart.precio) {
            finalCost = parseFloat(String(inventoryPart.precio)) || 0;
            usedField = 'precio';
          } else if (inventoryPart.cost) {
            finalCost = parseFloat(String(inventoryPart.cost)) || 0;
            usedField = 'cost';
          } else if (inventoryPart.price) {
            finalCost = parseFloat(String(inventoryPart.price)) || 0;
            usedField = 'price';
          }
          
          console.log(`💰 Resultado del autocompletado:`);
          console.log(`  Campo usado: ${usedField}`);
          console.log(`  Costo final: $${finalCost.toFixed(2)}`);
          
        } else {
          console.log('⚠️ Parte no encontrada en inventario, usando costTax de receives');
          const fallbackCost = parseFloat(String(testPart.costTax)) || 0;
          console.log(`💰 Costo de fallback: $${fallbackCost.toFixed(2)}`);
        }
      }
    }

    console.log('\n🎯 RESUMEN DE FUNCIONALIDAD:');
    console.log('✅ Al seleccionar SKU en formulario se debe autocompletar:');
    console.log('  1. SKU (ya seleccionado)');
    console.log('  2. Nombre de la parte (desde inventory.part o inventory.description)');
    console.log('  3. Costo unitario (prioridad: precio > cost > price > costTax)');
    console.log('✅ Al hacer clic en "Add" de parte pendiente se debe autocompletar todo');
    console.log('✅ El datalist debe mostrar: "Nombre - $Precio"');

  } catch (error) {
    console.error('❌ Error testing autocompletado:', error.message);
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('- Verifica que el backend esté funcionando');
    console.log('- Verifica que haya items en el inventario con precios');
    console.log('- Verifica que el frontend esté haciendo las llamadas correctas');
  }
}

testAutocompletadoCostos();
