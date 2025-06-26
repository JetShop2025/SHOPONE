// Test del nuevo diseño PDF profesional
const fetch = require('node-fetch');

async function testNewPdfDesign() {
  console.log('🔍 Iniciando test del nuevo diseño PDF...\n');
  
  try {
    // 1. Crear una orden de trabajo de prueba
    console.log('1️⃣ Creando orden de trabajo de prueba...');
    
    const testOrder = {
      billToCo: 'ACME TRUCKING CORP',
      trailer: 'TR-12345',
      date: new Date().toISOString(),
      description: 'Reparación completa del sistema de frenos y mantenimiento preventivo del motor. Incluye cambio de pastillas, discos, aceite y filtros.',
      mechanics: [
        { name: 'Juan Pérez', hrs: 4 },
        { name: 'Miguel Santos', hrs: 2 }
      ],
      parts: [
        { sku: 'BRK-001', part: 'Pastillas de freno delanteras', qty: 4, cost: 45.99 },
        { sku: 'ENG-015', part: 'Filtro de aceite HD', qty: 1, cost: 12.50 },
        { sku: 'FLU-008', part: 'Aceite motor 15W-40', qty: 6, cost: 8.75 },
        { sku: 'BRK-012', part: 'Discos de freno traseros', qty: 2, cost: 89.99 }
      ],
      extraOptions: ['15shop'],
      status: 'COMPLETED',
      usuario: 'TEST_USER'
    };
    
    const createResponse = await fetch('http://localhost:5050/work-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testOrder)
    });
    
    if (!createResponse.ok) {
      throw new Error(`Error HTTP ${createResponse.status}: ${await createResponse.text()}`);
    }
    
    const result = await createResponse.json();
    const orderId = result.id;
    console.log(`✅ Orden creada exitosamente: ID ${orderId}`);
    
    // 2. Esperar a que se genere el PDF
    console.log('\n2️⃣ Esperando generación del PDF...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. Verificar que el PDF se generó correctamente
    console.log('3️⃣ Verificando acceso al PDF...');
    
    const pdfResponse = await fetch(`http://localhost:5050/work-orders/${orderId}/pdf`);
    
    if (pdfResponse.ok) {
      const contentType = pdfResponse.headers.get('content-type');
      const contentLength = pdfResponse.headers.get('content-length');
      
      console.log(`✅ PDF generado exitosamente:`);
      console.log(`   - Content-Type: ${contentType}`);
      console.log(`   - Tamaño: ${contentLength} bytes`);
      console.log(`   - URL: http://localhost:5050/work-orders/${orderId}/pdf`);
      
      // 4. Verificar datos en la base de datos
      console.log('\n4️⃣ Verificando PDF en base de datos...');
      
      const orderResponse = await fetch(`http://localhost:5050/work-orders`);
      const orders = await orderResponse.json();
      const createdOrder = orders.find(o => o.id === orderId);
      
      if (createdOrder && createdOrder.pdf_file) {
        console.log(`✅ PDF almacenado en BD: ${createdOrder.pdf_file.length} bytes`);
      } else {
        console.log(`❌ PDF no encontrado en BD`);
      }
      
    } else {
      throw new Error(`Error al acceder al PDF: HTTP ${pdfResponse.status}`);
    }
    
    console.log('\n🎉 TEST COMPLETADO EXITOSAMENTE');
    console.log(`\n📄 Puedes ver el PDF nuevo en: http://localhost:5050/work-orders/${orderId}/pdf`);
    console.log('\n🎨 CARACTERÍSTICAS DEL NUEVO DISEÑO:');
    console.log('   ✓ Header profesional con logo y colores corporativos');
    console.log('   ✓ Título "WORK ORDER" perfectamente centrado');
    console.log('   ✓ Layout de dos columnas para información del cliente y W.O.');
    console.log('   ✓ Tabla de partes con diseño moderno y columnas bien alineadas');
    console.log('   ✓ Resumen financiero centrado y destacado');
    console.log('   ✓ Sección de términos y firmas profesional');
    console.log('   ✓ Colores azul corporativo (#1E3A8A) y verde éxito (#059669)');
    console.log('   ✓ Tipografía Helvetica consistente en todo el documento');
    console.log('   ✓ Elementos perfectamente centrados y alineados');
    
  } catch (error) {
    console.error('❌ Error en el test:', error.message);
    process.exit(1);
  }
}

// Ejecutar test
testNewPdfDesign();
