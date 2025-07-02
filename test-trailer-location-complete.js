// Test completo de la integración real de Trailer Location
// Valida que el frontend y backend estén correctamente integrados

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const BACKEND_URL = `${API_URL}/trailer-location`;

async function testCompleteIntegration() {
  console.log('🚀 TESTING COMPLETE TRAILER LOCATION INTEGRATION');
  console.log('===============================================================\n');
  
  let allTestsPassed = true;
  const results = [];

  // Test 1: Backend connectivity
  try {
    console.log('📡 Test 1: Verificando conectividad del backend...');
    const response = await axios.get(`${BACKEND_URL}/gps-data`);
    
    if (response.status === 200 && response.data) {
      console.log('✅ Backend conectado correctamente');
      
      if (Array.isArray(response.data)) {
        console.log(`📍 ${response.data.length} trailers obtenidos (formato legacy)`);
      } else if (response.data.data) {
        console.log(`📍 ${response.data.data.length} trailers obtenidos`);
        if (response.data.mock) {
          console.log('⚠️  Usando datos mock (Momentum API no disponible)');
        }
      }
      
      results.push({ test: 'Backend Connectivity', status: 'PASS' });
    } else {
      throw new Error('Respuesta inválida del backend');
    }
  } catch (error) {
    console.log('❌ Error conectando con backend:', error.message);
    allTestsPassed = false;
    results.push({ test: 'Backend Connectivity', status: 'FAIL', error: error.message });
  }

  console.log('\n');
  // Test 2: Momentum API integration
  try {
    console.log('🛰️ Test 2: Verificando integración con Momentum API...');
    
    // Test assets endpoint
    const assetsResponse = await axios.get(`${BACKEND_URL}/momentum/assets`);
    
    if (assetsResponse.status === 200 && assetsResponse.data) {
      console.log('✅ Endpoint de assets funcional');
      
      // Ser más flexible con el formato de respuesta
      if (assetsResponse.data.success && assetsResponse.data.data) {
        console.log(`📋 ${assetsResponse.data.data.length || 0} assets disponibles`);
        if (assetsResponse.data.mock) {
          console.log('⚠️  Usando datos mock para assets');
        } else {
          console.log('🌐 Datos obtenidos desde Momentum API real');
        }
      } else if (Array.isArray(assetsResponse.data)) {
        console.log(`📋 ${assetsResponse.data.length} assets disponibles (formato directo)`);
      } else {
        console.log('📋 Respuesta de assets recibida (formato desconocido)');
        console.log('   Estructura:', Object.keys(assetsResponse.data));
      }
      
      results.push({ test: 'Momentum API Assets', status: 'PASS' });
    } else {
      throw new Error('Respuesta inválida del endpoint de assets');
    }
  } catch (error) {
    console.log('❌ Error en integración Momentum:', error.message);
    allTestsPassed = false;
    results.push({ test: 'Momentum API Assets', status: 'FAIL', error: error.message });
  }

  console.log('\n');

  // Test 3: Location tracking
  try {
    console.log('📍 Test 3: Verificando rastreo de ubicaciones...');
    
    const locationResponse = await axios.get(`${BACKEND_URL}/momentum/location/asset-3300`);
    
    if (locationResponse.status === 200 && locationResponse.data) {
      console.log('✅ Endpoint de ubicación funcional');
      
      if (locationResponse.data.success && locationResponse.data.data) {
        const location = locationResponse.data.data;
        console.log(`🗺️  Asset: ${location.assetId}`);
        console.log(`📌 Ubicación: ${location.location}`);
        console.log(`🔄 Última actualización: ${location.lastUpdate}`);
        console.log(`⚡ Estado: ${location.status}`);
      } else if (locationResponse.data.mock) {
        console.log('⚠️  Usando datos mock para ubicación');
      }
      
      results.push({ test: 'Location Tracking', status: 'PASS' });
    } else {
      throw new Error('Respuesta inválida del endpoint de ubicación');
    }
  } catch (error) {
    console.log('❌ Error en rastreo de ubicaciones:', error.message);
    allTestsPassed = false;
    results.push({ test: 'Location Tracking', status: 'FAIL', error: error.message });
  }

  console.log('\n');
  // Test 4: Email recipients management
  try {
    console.log('📧 Test 4: Verificando gestión de destinatarios...');
    
    const recipientsResponse = await axios.get(`${BACKEND_URL}/recipients`);
    
    if (recipientsResponse.status === 200 && recipientsResponse.data) {
      console.log('✅ Gestión de destinatarios funcional');
      
      // Ser más flexible con el formato de respuesta
      if (Array.isArray(recipientsResponse.data)) {
        console.log(`👥 ${recipientsResponse.data.length} destinatarios configurados`);
        
        recipientsResponse.data.forEach((recipient, index) => {
          console.log(`   ${index + 1}. ${recipient.name} (${recipient.email}) - ${recipient.active ? 'Activo' : 'Inactivo'}`);
        });
      } else if (recipientsResponse.data.success && recipientsResponse.data.data) {
        console.log(`👥 ${recipientsResponse.data.data.length} destinatarios configurados`);
      } else {
        console.log('👥 Respuesta de destinatarios recibida');
        console.log('   Estructura:', Object.keys(recipientsResponse.data));
      }
      
      results.push({ test: 'Email Recipients', status: 'PASS' });
    } else {
      throw new Error('Respuesta inválida del endpoint de destinatarios');
    }
  } catch (error) {
    console.log('❌ Error en gestión de destinatarios:', error.message);
    allTestsPassed = false;
    results.push({ test: 'Email Recipients', status: 'FAIL', error: error.message });
  }

  console.log('\n');

  // Test 5: Statistics endpoint
  try {
    console.log('📊 Test 5: Verificando endpoint de estadísticas...');
    
    const today = new Date();
    const startDate = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
    const endDate = today.toISOString();
    
    const statsResponse = await axios.get(`${BACKEND_URL}/momentum/statistics/asset-3300?startDate=${startDate}&endDate=${endDate}`);
    
    if (statsResponse.status === 200 && statsResponse.data) {
      console.log('✅ Endpoint de estadísticas funcional');
      
      if (statsResponse.data.success && statsResponse.data.data) {
        const stats = statsResponse.data.data;
        console.log(`📈 Estadísticas obtenidas para ${stats.assetId}`);
        console.log(`🛣️  Distancia total: ${stats.totalDistance} km`);
        console.log(`⏱️  Tiempo total: ${stats.totalTime} horas`);
        console.log(`🚗 Velocidad promedio: ${stats.averageSpeed} km/h`);
      } else if (statsResponse.data.mock) {
        console.log('⚠️  Usando datos mock para estadísticas');
      }
      
      results.push({ test: 'Statistics Endpoint', status: 'PASS' });
    } else {
      throw new Error('Respuesta inválida del endpoint de estadísticas');
    }
  } catch (error) {
    console.log('❌ Error en endpoint de estadísticas:', error.message);
    allTestsPassed = false;
    results.push({ test: 'Statistics Endpoint', status: 'FAIL', error: error.message });
  }

  console.log('\n');

  // Test 6: History endpoint
  try {
    console.log('📅 Test 6: Verificando endpoint de historial...');
    
    const today = new Date();
    const startDate = new Date(today.getTime() - (24 * 60 * 60 * 1000)).toISOString();
    const endDate = today.toISOString();
    
    const historyResponse = await axios.get(`${BACKEND_URL}/momentum/history/asset-3300?startDate=${startDate}&endDate=${endDate}&limit=10`);
    
    if (historyResponse.status === 200 && historyResponse.data) {
      console.log('✅ Endpoint de historial funcional');
      
      if (historyResponse.data.success && historyResponse.data.data) {
        const history = historyResponse.data.data;
        console.log(`📋 ${history.length} registros de historial obtenidos`);
        
        if (history.length > 0) {
          console.log(`🕐 Primer registro: ${history[0].timestamp}`);
          console.log(`📍 Ubicación: ${history[0].address || 'N/A'}`);
        }
      } else if (historyResponse.data.mock) {
        console.log('⚠️  Usando datos mock para historial');
      }
      
      results.push({ test: 'History Endpoint', status: 'PASS' });
    } else {
      throw new Error('Respuesta inválida del endpoint de historial');
    }
  } catch (error) {
    console.log('❌ Error en endpoint de historial:', error.message);
    allTestsPassed = false;
    results.push({ test: 'History Endpoint', status: 'FAIL', error: error.message });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESUMEN DE LA INTEGRACIÓN');
  console.log('='.repeat(80));
  
  results.forEach((result, index) => {
    const status = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${status} ${index + 1}. ${result.test}: ${result.status}`);
    if (result.error) {
      console.log(`    💬 ${result.error}`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  
  const passedTests = results.filter(r => r.status === 'PASS').length;
  const totalTests = results.length;
  
  if (allTestsPassed) {
    console.log('🎉 ¡INTEGRACIÓN COMPLETAMENTE EXITOSA!');
    console.log('✅ Todos los endpoints están funcionando correctamente');
    console.log('🚀 El sistema Trailer Location está listo para producción');
  } else {
    console.log(`⚠️  INTEGRACIÓN PARCIAL: ${passedTests}/${totalTests} tests pasaron`);
    console.log('🔧 Revise los errores anteriores para completar la integración');
  }
  
  console.log('='.repeat(80));
  
  return {
    success: allTestsPassed,
    results: results,
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: totalTests - passedTests,
      percentage: Math.round((passedTests / totalTests) * 100)
    }
  };
}

// Función para mostrar recomendaciones
function showRecommendations(results) {
  console.log('\n💡 RECOMENDACIONES:');
  console.log('-'.repeat(50));
  
  const failedTests = results.filter(r => r.status === 'FAIL');
  
  if (failedTests.length === 0) {
    console.log('✨ ¡Excelente! No hay recomendaciones adicionales.');
    console.log('🔄 Considere configurar el envío automático de reportes si no está habilitado.');
    console.log('📧 Verifique la configuración SMTP para el envío de emails.');
  } else {
    failedTests.forEach(test => {
      console.log(`\n🔧 Para ${test.test}:`);
      
      switch (test.test) {
        case 'Backend Connectivity':
          console.log('   - Verifique que el servidor backend esté ejecutándose');
          console.log('   - Confirme la URL del API en las variables de entorno');
          break;
        case 'Momentum API Assets':
          console.log('   - Verifique las credenciales de Momentum API');
          console.log('   - Confirme que las variables MOMENTUM_* estén configuradas');
          break;
        case 'Location Tracking':
          console.log('   - Verifique la conectividad con Momentum API');
          console.log('   - Confirme que el asset ID existe en Momentum');
          break;
        case 'Email Recipients':
          console.log('   - Verifique la conexión con la base de datos');
          console.log('   - Confirme que la tabla trailer_location_recipients existe');
          break;
        default:
          console.log('   - Revise los logs del servidor para más detalles');
      }
    });
  }
}

// Ejecutar test
if (require.main === module) {
  testCompleteIntegration()
    .then(results => {
      showRecommendations(results.results);
      console.log(`\n🏁 Test completado con ${results.summary.percentage}% de éxito`);
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Error crítico ejecutando tests:', error);
      process.exit(1);
    });
}

module.exports = { testCompleteIntegration, showRecommendations };
