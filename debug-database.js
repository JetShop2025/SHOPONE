const db = require('./backend/db');

(async () => {
  try {
    console.log('=== TABLA INVENTORY ===');
    const [inventory] = await db.query('SELECT sku, part, precio, cost FROM inventory LIMIT 5');
    console.log('Primeros 5 registros:');
    inventory.forEach(item => {
      console.log({
        sku: item.sku,
        part: item.part,
        precio: item.precio,
        cost: item.cost
      });
    });
    
    console.log('\n=== TABLA RECEIVES ===');
    const [receives] = await db.query('SELECT id, sku, item, destino_trailer, estatus, qty_remaining FROM receives WHERE estatus = "PENDING" LIMIT 5');
    console.log('Primeros 5 registros PENDING:');
    receives.forEach(item => {
      console.log({
        id: item.id,
        sku: item.sku,
        item: item.item,
        destino_trailer: item.destino_trailer,
        estatus: item.estatus,
        qty_remaining: item.qty_remaining
      });
    });
    
    console.log('\n=== TRAILERS CON PARTES PENDING ===');
    const [trailers] = await db.query('SELECT DISTINCT destino_trailer FROM receives WHERE estatus = "PENDING" AND destino_trailer IS NOT NULL');
    console.log('Trailers con partes pendientes:');
    trailers.forEach(t => console.log(t.destino_trailer));
    
    console.log('\n=== VERIFICAR ENDPOINT RECEIVES ===');
    const [allReceives] = await db.query('SELECT * FROM receives ORDER BY id DESC LIMIT 3');
    console.log('Últimos 3 registros de receives:');
    allReceives.forEach(item => {
      console.log(item);
    });
    
    await db.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
