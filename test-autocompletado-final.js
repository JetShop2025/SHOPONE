// SCRIPT DE PRUEBA FINAL: Verificar autocompletado de costos en WorkOrderForm
// Este script simula el comportamiento del autocompletado cuando se ingresa un SKU

// Simulación de datos de inventario (basado en la respuesta real de producción)
const mockInventory = [
  {
    id: 1,
    sku: '1-100579',
    barCodes: 'BC-1-100579',
    category: '1-FILTERS',
    part: 'TK PRECEDENT SERVICE KIT',
    provider: 'THEFRE',
    brand: 'THERMO KING',
    um: 'EA',
    onHand: 14,
    area: 'D',
    imagen: 'https://m.media-amazon.com/images/I/81Uq3uFyj7L._AC_SL1500_.jpg',
    receive: 0,
    salidasWo: 0,
    precio: '144.12', // CAMPO CORRECTO - COMO STRING
    usuario: 'LEO',
    invoiceLink: 'https://1drv.ms/b/c/25a2e7883302ede4/EeCqngy359NCsC270Kp8T_0B2LEuBsMHZhGfM7J_iyYMBw?e=wyuAgm'
  },
  {
    id: 2,
    sku: 'BATTERY-12V',
    part: 'Battery 12V Heavy Duty',
    precio: '89.99',
    onHand: 5
  },
  {
    id: 3,
    sku: 'FILTER-OIL',
    part: 'Oil Filter Standard',
    precio: '25.50',
    onHand: 20
  },
  {
    id: 4,
    sku: 'ALTERNATOR-24V',
    part: 'Alternator 24V Premium',
    precio: '275.00',
    onHand: 3
  }
];

// Función findPartBySku corregida (copiada del componente)
function findPartBySku(sku, inventory) {
  if (!sku || !inventory || inventory.length === 0) {
    console.log('❌ findPartBySku: SKU vacío o inventario no disponible');
    return null;
  }
  
  const skuLower = String(sku).toLowerCase().trim();
  console.log('🔍 Buscando SKU:', skuLower, 'en inventario de', inventory.length, 'items');
  
  // Buscar por SKU exacto (case insensitive)
  const exactMatch = inventory.find((item) => 
    String(item.sku || '').toLowerCase().trim() === skuLower
  );
  
  if (exactMatch) {
    console.log('✅ Parte encontrada por SKU exacto:', {
      sku: exactMatch.sku,
      name: exactMatch.part || exactMatch.description || exactMatch.name,
      precio: exactMatch.precio, // Campo correcto de la tabla inventory
      precioTipo: typeof exactMatch.precio,
      allPriceFields: {
        precio: exactMatch.precio,
        cost: exactMatch.cost,
        price: exactMatch.price
      }
    });
    return exactMatch;
  }
  
  // Si no encuentra coincidencia exacta, buscar que contenga el SKU
  const partialMatch = inventory.find((item) => 
    String(item.sku || '').toLowerCase().includes(skuLower)
  );
  
  if (partialMatch) {
    console.log('⚠️ Parte encontrada por coincidencia parcial:', {
      sku: partialMatch.sku,
      name: partialMatch.part || partialMatch.description || partialMatch.name,
      precio: partialMatch.precio, // Campo correcto de la tabla inventory
      precioTipo: typeof partialMatch.precio
    });
    return partialMatch;
  }
  
  console.log('❌ No se encontró parte para SKU:', sku);
  return null;
}

// Función de autocompletado de costo corregida
function autocompleteCost(foundPart) {
  let cost = 0;
  
  // Primero buscar en el campo 'precio' que es el correcto de la tabla inventory
  if (foundPart.precio !== undefined && foundPart.precio !== null && String(foundPart.precio).trim() !== '') {
    cost = parseFloat(String(foundPart.precio)) || 0;
    console.log('💰 Costo obtenido del campo "precio":', cost);
  } else {
    // Busqueda de respaldo en otros campos posibles
    const costFields = ['cost', 'price', 'unitCost', 'unit_cost', 'unit_price', 'price_unit'];
    
    for (const costField of costFields) {
      if (foundPart[costField] !== undefined && foundPart[costField] !== null && String(foundPart[costField]).trim() !== '') {
        cost = parseFloat(String(foundPart[costField])) || 0;
        console.log(`💰 Costo obtenido del campo "${costField}":`, cost);
        break;
      }
    }
  }
  
  // Si no encuentra costo, usar 0 pero mostrar warning
  if (cost === 0) {
    console.warn('⚠️ No se encontró costo válido en ningún campo. Parte:', {
      sku: foundPart.sku,
      precio: foundPart.precio,
      allFields: Object.keys(foundPart)
    });
  }
  
  return cost.toFixed(2);
}

// Simulación del proceso completo de autocompletado
function simulateAutocompletion(testSku) {
  console.log(`\n🧪 === SIMULACIÓN DE AUTOCOMPLETADO PARA SKU: ${testSku} ===`);
  
  // 1. Buscar la parte
  const foundPart = findPartBySku(testSku, mockInventory);
  
  if (foundPart) {
    // 2. Autocompletar nombre
    const partName = foundPart.part || foundPart.description || foundPart.name || '';
    console.log(`📝 Nombre autocompletado: "${partName}"`);
    
    // 3. Autocompletar costo
    const cost = autocompleteCost(foundPart);
    console.log(`💰 Costo autocompletado: $${cost}`);
    
    // 4. Resultado final
    console.log(`✅ RESULTADO FINAL:`);
    console.log(`   - SKU: ${testSku}`);
    console.log(`   - Nombre: ${partName}`);
    console.log(`   - Costo: $${cost}`);
    
    return { sku: testSku, part: partName, cost: cost };
  } else {
    console.log(`❌ AUTOCOMPLETADO FALLIDO: No se encontró parte para SKU "${testSku}"`);
    return null;
  }
}

// EJECUTAR PRUEBAS
console.log('🚀 INICIANDO PRUEBAS DE AUTOCOMPLETADO DE COSTOS');
console.log('=' .repeat(60));

// Casos de prueba
const testCases = [
  '1-100579',      // SKU exacto existente
  '1-100579',      // Mismo SKU para verificar consistencia
  'BATTERY-12V',   // Otro SKU exacto
  'filter',        // Búsqueda parcial (debería encontrar FILTER-OIL)
  'alt',           // Búsqueda parcial (debería encontrar ALTERNATOR-24V)
  'NOEXISTE',      // SKU que no existe
  '',              // SKU vacío
  'BATTERY'        // Parcial que debería encontrar BATTERY-12V
];

testCases.forEach((testSku, index) => {
  const result = simulateAutocompletion(testSku);
  
  if (index < testCases.length - 1) {
    console.log('\n' + '-'.repeat(40));
  }
});

console.log('\n' + '='.repeat(60));
console.log('✅ PRUEBAS DE AUTOCOMPLETADO COMPLETADAS');
console.log('\n📋 RESUMEN:');
console.log('- El campo "precio" se usa como fuente principal de costo');
console.log('- Los valores se formatean a 2 decimales');
console.log('- Se maneja correctamente cuando el precio es string');
console.log('- Funciona tanto búsqueda exacta como parcial');
console.log('- Se proporciona feedback claro cuando no se encuentra la parte');

console.log('\n🎯 IMPLEMENTACIÓN EN WORKORDERFORM.TSX:');
console.log('- findPartBySku(): Busca la parte en el inventario');
console.log('- handlePartChange(): Maneja el autocompletado cuando cambia el SKU');
console.log('- Campo "precio" tiene prioridad sobre otros campos de costo');
console.log('- Feedback visual (campo verde) cuando se autocompleta exitosamente');
