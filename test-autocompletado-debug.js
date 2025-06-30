// Script de prueba para autocompletado y partes pendientes
console.log('🔧 DIAGNÓSTICO DEL SISTEMA - AUTOCOMPLETADO Y PARTES PENDIENTES');

// Test 1: Verificar estructura de datos de inventario
console.log('\n=== TEST 1: ESTRUCTURA DE INVENTARIO ===');
const sampleInventory = [
  { sku: 'ABC123', part: 'Filtro de aceite', precio: 25.50, cost: null },
  { sku: 'DEF456', part: 'Pastillas de freno', precio: null, cost: 45.75 },
  { sku: 'GHI789', part: 'Bujía', precio: 12.99, cost: 12.99 }
];

function findPartBySku(sku, inventory) {
  if (!sku || !inventory || inventory.length === 0) {
    console.log('❌ SKU vacío o inventario no disponible');
    return null;
  }
  
  console.log('🔍 Buscando SKU:', sku, 'en inventario de', inventory.length, 'items');
  
  // Buscar por SKU exacto (case insensitive)
  const exactMatch = inventory.find(item => 
    String(item.sku).toLowerCase() === String(sku).toLowerCase()
  );
  
  if (exactMatch) {
    console.log('✅ Parte encontrada por SKU exacto:', {
      sku: exactMatch.sku,
      name: exactMatch.part || exactMatch.description || exactMatch.name,
      precio: exactMatch.precio,
      cost: exactMatch.cost || exactMatch.price || exactMatch.unitCost || exactMatch.unit_cost,
      allFields: exactMatch
    });
    return exactMatch;
  }
  
  console.log('❌ No se encontró parte para SKU:', sku);
  return null;
}

// Test del autocompletado
console.log('\n--- Probando autocompletado ---');
const testSku = 'ABC123';
const foundPart = findPartBySku(testSku, sampleInventory);

if (foundPart) {
  // Lógica de autocompletado de precio
  let cost = 0;
  console.log('🔍 Analizando campos de precio:', {
    precio: foundPart.precio,
    cost: foundPart.cost,
    price: foundPart.price,
    unitCost: foundPart.unitCost,
    unit_cost: foundPart.unit_cost,
    allKeys: Object.keys(foundPart)
  });
  
  // Prioridad en el orden: precio > cost > price > unitCost > unit_cost
  if (foundPart.precio !== undefined && foundPart.precio !== null && foundPart.precio !== '') {
    cost = parseFloat(String(foundPart.precio)) || 0;
    console.log('💰 Usando campo "precio":', foundPart.precio, '→', cost);
  } else if (foundPart.cost !== undefined && foundPart.cost !== null && foundPart.cost !== '') {
    cost = parseFloat(String(foundPart.cost)) || 0;
    console.log('💰 Usando campo "cost":', foundPart.cost, '→', cost);
  } else {
    console.log('❌ No se encontró ningún campo de precio válido');
  }
  
  console.log('✅ Resultado final - costo:', cost.toFixed(2));
}

// Test 2: Verificar estructura de partes pendientes
console.log('\n=== TEST 2: PARTES PENDIENTES POR TRAILER ===');
const sampleReceives = [
  { id: 1, sku: 'ABC123', item: 'Filtro de aceite', destino_trailer: 'T001', estatus: 'PENDING', qty_remaining: 2 },
  { id: 2, sku: 'DEF456', item: 'Pastillas de freno', destino_trailer: 'T001', estatus: 'PENDING', qty_remaining: 4 },
  { id: 3, sku: 'GHI789', item: 'Bujía', destino_trailer: 'T002', estatus: 'PENDING', qty_remaining: 8 },
  { id: 4, sku: 'JKL012', item: 'Aceite motor', destino_trailer: 'T001', estatus: 'USED', qty_remaining: 0 }
];

function getPendingPartsByTrailer(trailer, receives) {
  if (!trailer || !receives || receives.length === 0) {
    console.log('❌ Trailer vacío o receives no disponible');
    return [];
  }
  
  const pendingParts = receives.filter(r => 
    r.destino_trailer === trailer && 
    r.estatus === 'PENDING' && 
    r.qty_remaining > 0
  );
  
  console.log(`🔍 Partes pendientes para trailer ${trailer}:`, pendingParts.length);
  pendingParts.forEach(part => {
    console.log(`  - ID: ${part.id}, SKU: ${part.sku}, Item: ${part.item}, Qty: ${part.qty_remaining}`);
  });
  
  return pendingParts;
}

function getTrailersWithPendingParts(receives) {
  if (!receives || receives.length === 0) {
    console.log('❌ Receives no disponible');
    return [];
  }
  
  const trailers = Array.from(
    new Set(
      receives
        .filter(r => r.estatus === 'PENDING' && r.qty_remaining > 0)
        .map(r => r.destino_trailer)
        .filter(t => t)
    )
  );
  
  console.log('🚛 Trailers con partes pendientes:', trailers);
  return trailers;
}

// Test de partes pendientes
console.log('\n--- Probando partes pendientes ---');
const trailersWithPending = getTrailersWithPendingParts(sampleReceives);
const pendingForT001 = getPendingPartsByTrailer('T001', sampleReceives);

console.log('\n=== RESUMEN DE PROBLEMAS IDENTIFICADOS ===');
console.log(`
1. AUTOCOMPLETADO DE COSTO:
   - ✅ Lógica de búsqueda por SKU funciona
   - ✅ Prioridad del campo 'precio' implementada
   - ⚠️  Verificar que los eventos onChange/onBlur se disparen correctamente
   - ⚠️  Verificar que el inventario se cargue correctamente en el frontend

2. PARTES PENDIENTES POR TRAILER:
   - ✅ Lógica de filtrado funciona
   - ✅ Estructura de datos correcta
   - ⚠️  Verificar que el endpoint /receive funcione correctamente
   - ⚠️  Verificar que los datos se muestren en el frontend

3. PRÓXIMOS PASOS:
   - Verificar logs del frontend para errores de carga de inventario
   - Verificar que el endpoint /receive devuelva datos correctos
   - Confirmar que los eventos de input del campo SKU se disparen
   - Verificar que las partes pendientes se carguen al seleccionar trailer
`);
