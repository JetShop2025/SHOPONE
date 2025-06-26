require('dotenv').config({ path: './backend/.env' });

async function testNewPdfSystem() {
  try {
    console.log('🧪 Probando el nuevo sistema de PDF...\n');
    
    // Test 1: Probar PDF de orden existente (76)
    console.log('📄 Test 1: Probando acceso a PDF de orden 76...');
    const pdfResponse = await fetch('http://localhost:5050/work-orders/76/pdf');
    console.log(`Status: ${pdfResponse.status}`);
    
    if (pdfResponse.ok) {
      const contentType = pdfResponse.headers.get('content-type');
      console.log(`Content-Type: ${contentType}`);
      console.log('✅ PDF de orden 76 accesible correctamente');
    } else {
      const errorText = await pdfResponse.text();
      console.log(`❌ Error: ${errorText}`);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Crear una nueva orden para probar la generación automática
    console.log('📄 Test 2: Creando nueva orden para probar generación automática...');
    const createResponse = await fetch('http://localhost:5050/work-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        billToCo: 'TEST COMPANY - PDF',
        date: '2025-06-26',
        description: 'Test order para formato invoice profesional',
        trailer: 'TEST-PDF-001',
        mechanics: [
          { name: 'Juan Pérez', hrs: '4' },
          { name: 'Carlos López', hrs: '2' }
        ],
        parts: [
          { sku: 'BRK001', part: 'Brake Pad Set', qty: 2, cost: 45.50 },
          { sku: 'OIL002', part: 'Engine Oil Filter', qty: 1, cost: 12.99 }
        ],
        status: 'PENDING',
        extraOptions: ['15shop'],
        totalLabAndParts: '$425.50'
      })
    });
    
    const createResult = await createResponse.json();
    console.log('Orden creada:', createResult);
    
    if (createResult.id) {
      // Esperar un poco para que se genere el PDF
      console.log('\n⏳ Esperando generación automática de PDF...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Test 3: Verificar que el PDF se generó correctamente
      console.log('📄 Test 3: Verificando PDF generado automáticamente...');
      const newPdfResponse = await fetch(`http://localhost:5050/work-orders/${createResult.id}/pdf`);
      console.log(`Status: ${newPdfResponse.status}`);
      
      if (newPdfResponse.ok) {
        const contentLength = newPdfResponse.headers.get('content-length');
        console.log(`Content-Length: ${contentLength} bytes`);
        console.log('✅ PDF generado automáticamente correctamente');
      } else {
        const errorText = await newPdfResponse.text();
        console.log(`❌ Error: ${errorText}`);
      }
    }
    
    console.log('\n🎉 Pruebas completadas');
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  }
}

testNewPdfSystem();
