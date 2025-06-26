require('dotenv').config({ path: './backend/.env' });
const fs = require('fs');
const path = require('path');

async function testPdfEndpoint() {
  try {
    const id = 76;
    const pdfsDir = path.join(__dirname, 'backend/pdfs');
    
    console.log('Directorio PDFs:', pdfsDir);
    
    // Buscar el archivo PDF que contenga el ID de la orden
    const pdfFiles = fs.readdirSync(pdfsDir);
    console.log('Archivos PDF disponibles:', pdfFiles);
    
    const matchingPdf = pdfFiles.find(file => 
      file.endsWith(`_${id}.pdf`)
    );
    
    console.log(`PDF encontrado para orden ${id}:`, matchingPdf);
    
    if (matchingPdf) {
      const pdfPath = path.join(pdfsDir, matchingPdf);
      console.log('Ruta completa:', pdfPath);
      console.log('¿Existe?:', fs.existsSync(pdfPath));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPdfEndpoint();
