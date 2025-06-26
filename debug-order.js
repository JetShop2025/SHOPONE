require('dotenv').config({ path: './backend/.env' });
const db = require('./backend/db');

async function checkOrder() {
  try {
    const [results] = await db.query('SELECT id, date, idClassic FROM work_orders WHERE id = 76');
    console.log('Orden 76:', JSON.stringify(results[0], null, 2));
    
    if (results[0]) {
      const order = results[0];
      const date = order.date;
      console.log('Date original:', date);
      console.log('Date type:', typeof date);
      
      // Formatear fecha como MM-DD-YYYY
      let formattedDate = '';
      if (typeof date === 'string' && date.includes('-')) {
        const [yyyy, mm, dd] = date.split('-');
        formattedDate = `${mm}-${dd}-${yyyy}`;
      } else if (date && date.toISOString) {
        const isoDate = date.toISOString().slice(0, 10);
        const [yyyy, mm, dd] = isoDate.split('-');
        formattedDate = `${mm}-${dd}-${yyyy}`;
      }
      
      console.log('Fecha formateada:', formattedDate);
      const pdfName = `${formattedDate}_${order.idClassic || order.id}.pdf`;
      console.log('Nombre PDF esperado:', pdfName);
      
      // Verificar si existe
      const fs = require('fs');
      const path = require('path');
      const pdfPath = path.join(__dirname, 'backend/pdfs', pdfName);
      console.log('Ruta PDF:', pdfPath);
      console.log('¿Existe?:', fs.existsSync(pdfPath));
      
      // Listar archivos en pdfs
      const pdfFiles = fs.readdirSync(path.join(__dirname, 'backend/pdfs'));
      console.log('Archivos PDF disponibles:', pdfFiles);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkOrder();
