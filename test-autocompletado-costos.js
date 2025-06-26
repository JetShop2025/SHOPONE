const db = require('./backend/db');

async function testInventoryCosts() {
  try {
    console.log('🔗 Conectando a la base de datos usando db existente...');
    
    // Obtener muestra del inventario para verificar el campo precio
    console.log('\n📦 Verificando estructura de tabla inventory:');
    const [describe] = await db.query('DESCRIBE inventory');
    console.table(describe);
    
    // Obtener algunas partes de muestra con precios
    console.log('\n💰 Verificando partes con precios:');
    const [inventory] = await db.query(`
      SELECT sku, part, precio, onHand 
      FROM inventory 
      WHERE precio > 0 
      LIMIT 10
    `);
    
    console.log('Partes con precios encontradas:');
    console.table(inventory);
    
    // Buscar una parte específica por SKU para simular autocompletado
    if (inventory.length > 0) {
      const testSku = inventory[0].sku;
      console.log(`\n🔍 Prueba de búsqueda por SKU: ${testSku}`);
      
      const [searchResult] = await db.query(
        'SELECT * FROM inventory WHERE sku = ?',
        [testSku]
      );
      
      if (searchResult.length > 0) {
        const part = searchResult[0];
        console.log('✅ Parte encontrada:');
        console.log({
          sku: part.sku,
          part: part.part,
          precio: part.precio,
          tipo_precio: typeof part.precio,
          onHand: part.onHand
        });
        
        // Simular el autocompletado
        const cost = parseFloat(String(part.precio)) || 0;
        console.log(`\n💡 Autocompletado simulado:`);
        console.log(`- SKU: ${part.sku}`);
        console.log(`- Nombre: ${part.part}`);
        console.log(`- Costo: $${cost.toFixed(2)}`);
      }
    }
    
    // Verificar partes sin precio
    console.log('\n⚠️ Verificando partes sin precio:');
    const [noPriceCount] = await db.query(`
      SELECT COUNT(*) as count 
      FROM inventory 
      WHERE precio = 0 OR precio IS NULL
    `);
    
    console.log(`Partes sin precio: ${noPriceCount[0].count}`);
    
    if (noPriceCount[0].count > 0) {
      const [noPriceParts] = await db.query(`
        SELECT sku, part, precio 
        FROM inventory 
        WHERE precio = 0 OR precio IS NULL
        LIMIT 5
      `);
      console.table(noPriceParts);
    }
    
    // Test específico de autocompletado con SKUs comunes
    console.log('\n🧪 Test de autocompletado con SKUs de prueba:');
    const testSkus = ['1234', 'TEST', 'BATTERY', 'FILTER'];
    
    for (const sku of testSkus) {
      const [results] = await db.query(
        'SELECT sku, part, precio FROM inventory WHERE sku LIKE ? LIMIT 1',
        [`%${sku}%`]
      );
      
      if (results.length > 0) {
        const part = results[0];
        console.log(`✅ SKU "${sku}" -> ${part.sku}: ${part.part} - $${part.precio}`);
      } else {
        console.log(`❌ SKU "${sku}" -> No encontrado`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar el test
testInventoryCosts().then(() => {
  console.log('\n✅ Test de autocompletado de costos completado');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error en test:', err);
  process.exit(1);
});
