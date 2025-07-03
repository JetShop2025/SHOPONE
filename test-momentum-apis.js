#!/usr/bin/env node

/**
 * 🧪 SCRIPT DE VERIFICACIÓN DE APIS DE MOMENTUM
 * 
 * Este script verifica que todas las APIs necesarias estén disponibles
 * y funcionen correctamente con tus credenciales.
 */

const axios = require('axios');

// Configuración - REEMPLAZAR CON TUS DATOS REALES
const CONFIG = {
  baseURL: process.env.MOMENTUM_BASE_URL || 'https://api.momentumiot.com',
  username: process.env.MOMENTUM_USERNAME || 'TU_USUARIO_AQUI',
  password: process.env.MOMENTUM_PASSWORD || 'TU_PASSWORD_AQUI',
  tenantId: process.env.MOMENTUM_TENANT_ID || 'TU_TENANT_ID_AQUI',
  apiKey: process.env.MOMENTUM_API_KEY || 'TU_API_KEY_AQUI'
};

let authToken = null;

console.log('🔧 VERIFICACIÓN DE APIS DE MOMENTUM');
console.log('=====================================\n');

async function testAPI(name, testFunction) {
  try {
    console.log(`🧪 Probando: ${name}`);
    const result = await testFunction();
    console.log(`✅ ${name}: EXITOSO`);
    if (result) {
      console.log(`   Datos: ${JSON.stringify(result, null, 2).substring(0, 200)}...`);
    }
    console.log('');
    return true;
  } catch (error) {
    console.log(`❌ ${name}: ERROR`);
    console.log(`   Error: ${error.message}`);
    if (error.response) {
      console.log(`   HTTP Status: ${error.response.status}`);
      console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    console.log('');
    return false;
  }
}

// Test 1: Autenticación (múltiples métodos basados en APIs comunes de IoT)
async function testAuthentication() {
  const authMethods = [
    // Método 1: POST /auth/login (más común en APIs modernas)
    {
      name: 'POST /auth/login',
      url: '/auth/login',
      data: { username: CONFIG.username, password: CONFIG.password }
    },
    // Método 2: POST /api/auth/login 
    {
      name: 'POST /api/auth/login',
      url: '/api/auth/login',
      data: { username: CONFIG.username, password: CONFIG.password }
    },
    // Método 3: POST /v1/auth/signin
    {
      name: 'POST /v1/auth/signin',
      url: '/v1/auth/signin',
      data: { username: CONFIG.username, password: CONFIG.password }
    },
    // Método 4: POST /api/v1/auth/token
    {
      name: 'POST /api/v1/auth/token',
      url: '/api/v1/auth/token',
      data: { username: CONFIG.username, password: CONFIG.password }
    },
    // Método 5: POST /oauth/token (OAuth2)
    {
      name: 'POST /oauth/token',
      url: '/oauth/token',
      data: { 
        grant_type: 'password',
        username: CONFIG.username, 
        password: CONFIG.password,
        client_id: CONFIG.tenantId
      }
    }
  ];

  for (const method of authMethods) {
    try {
      console.log(`     Probando: ${method.name}`);
      const response = await axios.post(`${CONFIG.baseURL}${method.url}`, method.data);
      
      // Buscar token en diferentes campos posibles
      const token = response.data?.token || 
                   response.data?.access_token || 
                   response.data?.authToken ||
                   response.data?.jwt ||
                   response.data?.accessToken;
      
      if (token) {
        authToken = token;
        return { 
          method: method.name, 
          token: '***OBTENIDO***', 
          expires: response.data?.expires || response.data?.expires_in,
          tokenType: response.data?.token_type || 'Bearer'
        };
      }
    } catch (error) {
      console.log(`     ${method.name}: ${error.response?.status || error.message}`);
    }
  }

  // Método final: API Key directa
  if (CONFIG.apiKey && CONFIG.apiKey !== 'TU_API_KEY_AQUI') {
    authToken = CONFIG.apiKey;
    return { method: 'API Key Header', token: '***USANDO API KEY***' };
  }

  throw new Error('Ningún método de autenticación funcionó');
}

// Test 2: Lista de Assets (endpoints confirmados del Swagger)
async function testAssetsList() {
  if (!authToken) throw new Error('Necesita token de autenticación');
  
  const endpoints = [
    `/v1/webapp/tenant/${CONFIG.tenantId}/asset`, // Endpoint principal (detallado)
    `/v1/tenant/${CONFIG.tenantId}/asset`          // Endpoint alternativo (básico)
  ];

  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };

  // Si estamos usando API key, también probar estos headers
  if (CONFIG.apiKey && CONFIG.apiKey !== 'TU_API_KEY_AQUI') {
    headers['X-API-Key'] = CONFIG.apiKey;
    headers['API-Key'] = CONFIG.apiKey;
  }

  for (const endpoint of endpoints) {
    try {
      console.log(`     Probando: ${endpoint}`);
      const response = await axios.get(`${CONFIG.baseURL}${endpoint}`, { headers });
      
      if (response.data && Array.isArray(response.data)) {
        return {
          endpoint: endpoint,
          count: response.data.length,
          sample: response.data.slice(0, 2),
          structure: response.data[0] ? Object.keys(response.data[0]) : []
        };
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        return {
          endpoint: endpoint,
          count: response.data.data.length,
          sample: response.data.data.slice(0, 2),
          structure: response.data.data[0] ? Object.keys(response.data.data[0]) : []
        };
      }
    } catch (error) {
      console.log(`     ${endpoint}: ${error.response?.status || error.message}`);
    }
  }
  
  throw new Error('Ningún endpoint de assets funcionó');
}

// Test 3: Ubicación GPS usando locationId del asset (confirmado del Swagger)
async function testGPSLocation() {
  if (!authToken) throw new Error('Necesita token de autenticación');
  
  // Primero obtener assets para conseguir locationId
  const assetsResponse = await axios.get(
    `${CONFIG.baseURL}/v1/webapp/tenant/${CONFIG.tenantId}/asset`,
    {
      headers: { Authorization: `Bearer ${authToken}` }
    }
  );
  
  if (assetsResponse.data.length === 0) {
    throw new Error('No hay assets disponibles para probar ubicación');
  }
  
  const firstAsset = assetsResponse.data[0];
  const locationId = firstAsset.locationId;
  
  if (!locationId) {
    throw new Error('El asset no tiene locationId asignado');
  }
  
  // Probar endpoints de ubicación confirmados del Swagger
  const locationEndpoints = [
    `/v1/webapp/tenant/${CONFIG.tenantId}/location/${locationId}`, // Detallado
    `/v1/tenant/${CONFIG.tenantId}/location/${locationId}`          // Básico
  ];
  
  for (const endpoint of locationEndpoints) {
    try {
      console.log(`     Probando ubicación: ${endpoint}`);
      const locationResponse = await axios.get(`${CONFIG.baseURL}${endpoint}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      return {
        assetName: firstAsset.name || firstAsset.uniqueId,
        locationId: locationId,
        endpoint: endpoint,
        location: locationResponse.data,
        coordinates: locationResponse.data.coordinates
      };
    } catch (error) {
      console.log(`     Error en ${endpoint}: ${error.response?.status || error.message}`);
      continue;
    }
  }
  
  throw new Error('Ningún endpoint de ubicación funcionó');
}

// Test 4: Endpoints alternativos (si los principales fallan)
async function testAlternativeEndpoints() {
  const endpoints = [
    `/v1/assets`, // Posible endpoint alternativo
    `/v1/vehicles`, // Posible endpoint alternativo
    `/v1/fleet`, // Posible endpoint alternativo
    `/api/v1/tenant/${CONFIG.tenantId}/asset`, // Con /api prefix
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${CONFIG.baseURL}${endpoint}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      results.push({ endpoint, status: 'SUCCESS', count: response.data.length });
    } catch (error) {
      results.push({ 
        endpoint, 
        status: 'ERROR', 
        error: error.response?.status || error.message 
      });
    }
  }
  
  return results;
}

// Ejecutar todas las pruebas
async function runAllTests() {
  console.log(`🔗 URL Base: ${CONFIG.baseURL}`);
  console.log(`👤 Usuario: ${CONFIG.username}`);
  console.log(`🏢 Tenant ID: ${CONFIG.tenantId}`);
  console.log('');

  if (CONFIG.username === 'TU_USUARIO_AQUI') {
    console.log('⚠️  ADVERTENCIA: Usando credenciales de ejemplo');
    console.log('   Edita este archivo o configura variables de entorno');
    console.log('');
  }

  const results = {
    authentication: await testAPI('1. Autenticación (/v1/signin)', testAuthentication),
    assetsList: false,
    gpsLocation: false,
    alternatives: false
  };

  if (results.authentication) {
    results.assetsList = await testAPI('2. Lista de Assets (/v1/tenant/{id}/asset)', testAssetsList);
    
    if (results.assetsList) {
      results.gpsLocation = await testAPI('3. Ubicación GPS (/v1/webapp/tenant/{id}/asset/{assetId}/trip/current)', testGPSLocation);
    }
    
    results.alternatives = await testAPI('4. Endpoints Alternativos', testAlternativeEndpoints);
  }

  // Resumen final
  console.log('📊 RESUMEN DE RESULTADOS');
  console.log('========================');
  console.log(`✅ Autenticación: ${results.authentication ? 'FUNCIONANDO' : 'FALLANDO'}`);
  console.log(`✅ Lista de Assets: ${results.assetsList ? 'FUNCIONANDO' : 'FALLANDO'}`);
  console.log(`✅ Ubicación GPS: ${results.gpsLocation ? 'FUNCIONANDO' : 'FALLANDO'}`);
  console.log('');

  if (results.authentication && results.assetsList && results.gpsLocation) {
    console.log('🎉 ¡TODAS LAS APIS FUNCIONANDO!');
    console.log('   Tu sistema puede usar datos reales de Momentum');
  } else {
    console.log('⚠️  ALGUNAS APIS NO FUNCIONAN');
    console.log('   Contacta a Momentum para verificar:');
    console.log('   - URLs correctas de endpoints');
    console.log('   - Permisos de tu cuenta');
    console.log('   - Formato de autenticación');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, CONFIG };
