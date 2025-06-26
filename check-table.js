require('dotenv').config({ path: './backend/.env' });
const db = require('./backend/db');

async function checkTable() {
  try {
    const [results] = await db.query('DESCRIBE work_orders');
    console.log('Estructura de la tabla work_orders:');
    results.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
      // También verificar si hay PDFs en la tabla
    const [pdfCheck] = await db.query('SELECT id, pdf_file IS NOT NULL as has_pdf FROM work_orders WHERE id IN (68, 69, 70, 71, 72, 73, 74, 75, 76) ORDER BY id');
    console.log('\nEstado de PDFs en la base de datos:');
    pdfCheck.forEach(row => {
      console.log(`- Orden ${row.id}: ${row.has_pdf ? 'TIENE PDF' : 'NO TIENE PDF'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTable();
