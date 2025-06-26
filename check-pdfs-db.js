require('dotenv').config({ path: './backend/.env' });
const db = require('./backend/db');

async function checkPdfs() {
  try {
    const [results] = await db.query('SELECT id, pdf_file IS NOT NULL as has_pdf, LENGTH(pdf_file) as pdf_size FROM work_orders WHERE id IN (76, 201) ORDER BY id');
    console.log('Estado de PDFs en la base de datos:');
    results.forEach(row => {
      console.log(`- Orden ${row.id}: ${row.has_pdf ? 'TIENE PDF' : 'NO TIENE PDF'} ${row.pdf_size ? `(${row.pdf_size} bytes)` : ''}`);
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPdfs();
