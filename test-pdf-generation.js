require('dotenv').config({ path: './backend/.env' });

async function testPdfGeneration() {
  try {
    // Test para crear una nueva orden
    const createResponse = await fetch('http://localhost:5050/work-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        billToCo: 'TEST COMPANY',
        date: '2025-06-25',
        description: 'Test order for PDF generation',
        trailer: 'TEST-001',
        mechanics: [{ name: 'Test Mechanic', hrs: '2' }],
        parts: [{ sku: 'TEST-SKU', part: 'Test Part', qty: 1, cost: 10.00 }],
        status: 'PENDING',
        extraOptions: []
      })
    });
    
    const createResult = await createResponse.json();
    console.log('Orden creada:', createResult);
    
    if (createResult.id) {
      // Esperar un poco para que se genere el PDF
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test para obtener el PDF
      const pdfResponse = await fetch(`http://localhost:5050/work-orders/${createResult.id}/pdf`);
      console.log('Status del PDF:', pdfResponse.status);
      
      if (pdfResponse.ok) {
        console.log('✅ PDF generado y accesible correctamente');
      } else {
        console.log('❌ Error al acceder al PDF:', await pdfResponse.text());
      }
    }
    
  } catch (error) {
    console.error('Error en test:', error);
  }
}

testPdfGeneration();
