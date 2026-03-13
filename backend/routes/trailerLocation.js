const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const db = require('../db');
const router = express.Router();

router.use(express.json());

// Configuración de Momentum API (actualizada con nuevas rutas)
const MOMENTUM_CONFIG = {
  baseURL: process.env.MOMENTUM_BASE_URL || 'https://api.momentumiot.com',
  tenantId: process.env.MOMENTUM_TENANT_ID,
  apiKey: process.env.MOMENTUM_API_KEY,
  username: process.env.MOMENTUM_USERNAME,
  password: process.env.MOMENTUM_PASSWORD,
  jwtToken: process.env.MOMENTUM_JWT_TOKEN,
  token: null,
  tokenExpiry: null,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Verificar si tenemos las credenciales necesarias
const hasMomentumCredentials = () => {
  const hasUsernamePassword = MOMENTUM_CONFIG.username && MOMENTUM_CONFIG.password && MOMENTUM_CONFIG.tenantId;
  const hasJwtToken = MOMENTUM_CONFIG.jwtToken;
  const hasApiKey = MOMENTUM_CONFIG.apiKey && MOMENTUM_CONFIG.tenantId;
  
  console.log('🔐 Verificando credenciales de Momentum:');
  console.log(`   - Username/Password: ${hasUsernamePassword ? '✅' : '❌'}`);
  console.log(`   - JWT Token: ${hasJwtToken ? '✅' : '❌'}`);
  console.log(`   - API Key: ${hasApiKey ? '✅' : '❌'}`);
  console.log(`   - Tenant ID: ${MOMENTUM_CONFIG.tenantId ? '✅' : '❌'}`);
  
  return hasUsernamePassword || hasJwtToken || hasApiKey;
};

// Función para autenticarse con Momentum (actualizada)
const authenticateMomentum = async () => {
  try {
    // Si ya tenemos un JWT token configurado, usarlo directamente
    if (MOMENTUM_CONFIG.jwtToken) {
      console.log('🔑 Usando JWT token configurado');
      MOMENTUM_CONFIG.token = MOMENTUM_CONFIG.jwtToken;
      MOMENTUM_CONFIG.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
      MOMENTUM_CONFIG.headers.Authorization = `Bearer ${MOMENTUM_CONFIG.jwtToken}`;
      return MOMENTUM_CONFIG.jwtToken;
    }

    // Si tenemos username/password, autenticar
    if (MOMENTUM_CONFIG.username && MOMENTUM_CONFIG.password) {
      console.log('🔑 Autenticando con username/password...');
      
      const response = await axios.post(`${MOMENTUM_CONFIG.baseURL}/v1/signin`, {
        username: MOMENTUM_CONFIG.username,
        password: MOMENTUM_CONFIG.password
      }, {
        headers: MOMENTUM_CONFIG.headers
      });
      
      if (response.data && response.data.token) {
        MOMENTUM_CONFIG.token = response.data.token;
        MOMENTUM_CONFIG.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
        MOMENTUM_CONFIG.headers.Authorization = `Bearer ${response.data.token}`;
        console.log('✅ Autenticación con Momentum exitosa');
        return response.data.token;
      }
    }

    // Si tenemos API key, configurar headers
    if (MOMENTUM_CONFIG.apiKey) {
      console.log('🔑 Usando API Key configurada');
      MOMENTUM_CONFIG.headers.Authorization = `Bearer ${MOMENTUM_CONFIG.apiKey}`;
      // O dependiendo del formato que use Momentum:
      // MOMENTUM_CONFIG.headers['X-API-Key'] = MOMENTUM_CONFIG.apiKey;
      return MOMENTUM_CONFIG.apiKey;
    }

    console.error('❌ No hay credenciales de Momentum configuradas');
    return null;
  } catch (error) {
    console.error('❌ Error autenticando con Momentum:', error.response?.data || error.message);
    return null;
  }
};

// Verificar si el token es válido y renovar si es necesario
const ensureValidToken = async () => {
  if (!MOMENTUM_CONFIG.token || Date.now() >= MOMENTUM_CONFIG.tokenExpiry) {
    return await authenticateMomentum();
  }
  return MOMENTUM_CONFIG.token;
};

// Función para hacer llamadas a la API de Momentum
const momentumApiCall = async (endpoint, method = 'GET', data = null) => {
  try {
    // Verificar credenciales antes de hacer la llamada
    if (!hasMomentumCredentials()) {
      throw new Error('No hay credenciales de Momentum configuradas');
    }

    const token = await ensureValidToken();
    if (!token) {
      throw new Error('No se pudo autenticar con Momentum');
    }

    const config = {
      method,
      url: `${MOMENTUM_CONFIG.baseURL}${endpoint}`,
      headers: {
        ...MOMENTUM_CONFIG.headers,
        'Authorization': `Bearer ${token}`
      },
      timeout: 10000 // 10 segundos timeout
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.data = data;
    }

    console.log(`📡 Llamada a Momentum API: ${method} ${endpoint}`);
    const response = await axios(config);
    console.log(`✅ Respuesta de Momentum: ${response.status}`);
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error en llamada a Momentum API ${endpoint}:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    });
    
    // Relanzar el error para que el endpoint lo maneje
    throw error;
  }
};

// Configuración de email
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Función para logging de auditoría
async function logAccion(usuario, accion, tabla, registro_id, detalles = '') {
  try {
    await db.query(
      'INSERT INTO audit_log (usuario, accion, tabla, registro_id, detalles) VALUES (?, ?, ?, ?, ?)',
      [usuario, accion, tabla, registro_id, detalles]
    );
  } catch (err) {
    console.error('Error inserting into audit_log:', err);
  }
}

// 🚀 ENDPOINT 1: Obtener lista de assets/trailers desde Momentum
router.get('/momentum/assets', async (req, res) => {
  try {
    console.log('📍 Obteniendo lista de assets desde Momentum API...');
    
    // Verificar credenciales antes de hacer la llamada
    if (!hasMomentumCredentials()) {
      console.log('⚠️ No hay credenciales de Momentum - usando datos de prueba');
      
      const mockAssets = [
        { assetId: 'asset-3300', name: '3-300', type: 'TRAILER', status: 'ACTIVE', lastUpdate: new Date().toISOString() },
        { assetId: 'asset-3301', name: '3-301', type: 'TRAILER', status: 'ACTIVE', lastUpdate: new Date().toISOString() },
        { assetId: 'asset-1100', name: '1-100', type: 'TRAILER', status: 'MAINTENANCE', lastUpdate: new Date().toISOString() },
        { assetId: 'asset-1101', name: '1-101', type: 'TRAILER', status: 'ACTIVE', lastUpdate: new Date().toISOString() },
        { assetId: 'asset-201', name: '2-01', type: 'TRAILER', status: 'ACTIVE', lastUpdate: new Date().toISOString() }
      ];
      
      return res.json({
        success: true,
        data: mockAssets,
        count: mockAssets.length,
        mock: true,
        message: 'Usando datos de prueba - Configure las credenciales de Momentum en las variables de entorno'
      });
    }
      // Usar el endpoint principal confirmado del Swagger
    const assetsData = await momentumApiCall(`/v1/webapp/tenant/${MOMENTUM_CONFIG.tenantId}/asset`);
    
    // Transformar datos para nuestro frontend
    const transformedAssets = assetsData.map(asset => ({
      assetId: asset.id || asset.deviceId,
      name: asset.name,
      uniqueId: asset.uniqueId,
      internalId: asset.internalId,
      locationId: asset.locationId, // ← Importante para obtener GPS
      type: asset.type || 'TRAILER',
      status: asset.status || 'ACTIVE',
      isJobsiteTrackable: asset.isJobsiteTrackable,
      lastUpdate: asset.lastUpdate || new Date().toISOString()
    }));
    
    console.log(`✅ ${transformedAssets.length} assets obtenidos desde Momentum`);
    res.json({
      success: true,
      data: transformedAssets,
      count: transformedAssets.length,
      mock: false
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo assets desde Momentum:', error.message);
    
    // Fallback a datos mock con información del error
    const mockAssets = [
      { assetId: 'asset-3300', name: '3-300', type: 'TRAILER', status: 'ACTIVE', lastUpdate: new Date().toISOString() },
      { assetId: 'asset-3301', name: '3-301', type: 'TRAILER', status: 'ACTIVE', lastUpdate: new Date().toISOString() },
      { assetId: 'asset-1100', name: '1-100', type: 'TRAILER', status: 'MAINTENANCE', lastUpdate: new Date().toISOString() }
    ];
    
    res.json({
      success: true,
      data: mockAssets,
      count: mockAssets.length,
      mock: true,
      error: error.message,
      message: 'Error conectando con Momentum - usando datos de prueba'
    });  }
});

// 🔧 ENDPOINT DIAGNÓSTICO: Verificar configuración de Momentum
router.get('/momentum/diagnostics', async (req, res) => {
  try {
    console.log('🔧 Ejecutando diagnóstico de Momentum...');
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      momentum: {
        baseURL: MOMENTUM_CONFIG.baseURL,
        hasTenantId: !!MOMENTUM_CONFIG.tenantId,
        hasUsername: !!MOMENTUM_CONFIG.username,
        hasPassword: !!MOMENTUM_CONFIG.password,
        hasJwtToken: !!MOMENTUM_CONFIG.jwtToken,
        hasApiKey: !!MOMENTUM_CONFIG.apiKey,
        hasCredentials: hasMomentumCredentials(),
        tenantIdMasked: MOMENTUM_CONFIG.tenantId ? `${MOMENTUM_CONFIG.tenantId.substring(0, 4)}****` : null
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasMomentumTenantId: !!process.env.MOMENTUM_TENANT_ID,
        hasMomentumUsername: !!process.env.MOMENTUM_USERNAME,
        hasMomentumPassword: !!process.env.MOMENTUM_PASSWORD,
        hasMomentumJwtToken: !!process.env.MOMENTUM_JWT_TOKEN,
        hasMomentumApiKey: !!process.env.MOMENTUM_API_KEY
      },
      connectivity: {
        canAuthenticate: false,
        lastError: null
      }
    };

    // Intentar autenticación si tenemos credenciales
    if (hasMomentumCredentials()) {
      try {
        const token = await authenticateMomentum();
        diagnostics.connectivity.canAuthenticate = !!token;
        diagnostics.connectivity.hasToken = !!token;
        
        if (token) {
          console.log('✅ Autenticación exitosa en diagnóstico');
          
          // Intentar hacer una llamada simple a la API
          try {
            await momentumApiCall(`/v1/tenant/${MOMENTUM_CONFIG.tenantId}/asset`, 'GET');
            diagnostics.connectivity.canCallApi = true;
          } catch (apiError) {
            diagnostics.connectivity.canCallApi = false;
            diagnostics.connectivity.apiError = apiError.message;
          }
        }
      } catch (authError) {
        diagnostics.connectivity.canAuthenticate = false;
        diagnostics.connectivity.lastError = authError.message;
      }
    }

    res.json({
      success: true,
      data: diagnostics,
      recommendations: generateRecommendations(diagnostics)
    });
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: {
        timestamp: new Date().toISOString(),
        hasBasicConfig: !!MOMENTUM_CONFIG.baseURL
      }
    });
  }
});

// Función para generar recomendaciones basadas en el diagnóstico
function generateRecommendations(diagnostics) {
  const recommendations = [];
  
  if (!diagnostics.momentum.hasCredentials) {
    recommendations.push({
      type: 'critical',
      message: 'No hay credenciales de Momentum configuradas',
      action: 'Configure MOMENTUM_TENANT_ID, MOMENTUM_USERNAME, MOMENTUM_PASSWORD o MOMENTUM_JWT_TOKEN en las variables de entorno'
    });
  }
  
  if (!diagnostics.momentum.hasTenantId) {
    recommendations.push({
      type: 'critical',
      message: 'Falta MOMENTUM_TENANT_ID',
      action: 'Configure la variable de entorno MOMENTUM_TENANT_ID con su ID de tenant de Momentum'
    });
  }
  
  if (diagnostics.momentum.hasCredentials && !diagnostics.connectivity.canAuthenticate) {
    recommendations.push({
      type: 'error',
      message: 'No se puede autenticar con Momentum',
      action: 'Verifique que las credenciales sean correctas y que la URL base sea válida'
    });
  }
  
  if (diagnostics.connectivity.canAuthenticate && !diagnostics.connectivity.canCallApi) {
    recommendations.push({
      type: 'warning',
      message: 'Autenticación exitosa pero no se puede acceder a la API',
      action: 'Verifique que el tenant ID sea correcto y que tenga permisos para acceder a los assets'
    });
  }
  
  if (diagnostics.momentum.hasCredentials && diagnostics.connectivity.canAuthenticate && diagnostics.connectivity.canCallApi) {
    recommendations.push({
      type: 'success',
      message: 'Configuración de Momentum correcta',
      action: 'El sistema está listo para usar datos reales de Momentum'
    });
  }
    return recommendations;
}

// 🧪 ENDPOINT DE PRUEBA: Probar múltiples endpoints de Momentum
router.get('/momentum/test-endpoints', async (req, res) => {
  try {
    console.log('🧪 Probando múltiples endpoints de Momentum...');
    
    if (!hasMomentumCredentials()) {
      return res.json({
        success: false,
        message: 'No hay credenciales configuradas',
        tests: []
      });
    }    // Lista de endpoints confirmados del Swagger oficial de Momentum
    const endpointsToTest = [
      // Assets/Trailers endpoints (confirmados del Swagger)
      { name: 'Assets (webapp)', endpoint: `/v1/webapp/tenant/${MOMENTUM_CONFIG.tenantId}/asset`, method: 'GET' },
      { name: 'Assets (basic)', endpoint: `/v1/tenant/${MOMENTUM_CONFIG.tenantId}/asset`, method: 'GET' },
      
      // Location endpoints (confirmados del Swagger)  
      { name: 'Locations (webapp)', endpoint: `/v1/webapp/tenant/${MOMENTUM_CONFIG.tenantId}/location`, method: 'GET' },
      { name: 'Locations (basic)', endpoint: `/v1/tenant/${MOMENTUM_CONFIG.tenantId}/location`, method: 'GET' },
      
      // Otros endpoints del Swagger
      { name: 'Users', endpoint: `/v1/tenant/${MOMENTUM_CONFIG.tenantId}/user`, method: 'GET' },
      { name: 'Tenant Info', endpoint: `/v1/tenant/${MOMENTUM_CONFIG.tenantId}`, method: 'GET' },
      
      // Status endpoints generales
      { name: 'Health Check', endpoint: `/health`, method: 'GET' },
      { name: 'Status', endpoint: `/status`, method: 'GET' },
      { name: 'Version', endpoint: `/version`, method: 'GET' },
    ];

    const results = [];
    
    // Primero intentar autenticar
    let token = null;
    try {
      token = await authenticateMomentum();
    } catch (authError) {
      return res.json({
        success: false,
        message: 'Error de autenticación',
        authError: authError.message,
        tests: []
      });
    }

    // Probar cada endpoint
    for (const test of endpointsToTest) {
      try {
        console.log(`   Probando: ${test.endpoint}`);
        
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };

        // También probar con API key si está disponible
        if (MOMENTUM_CONFIG.apiKey) {
          headers['X-API-Key'] = MOMENTUM_CONFIG.apiKey;
          headers['API-Key'] = MOMENTUM_CONFIG.apiKey;
        }

        const response = await axios({
          method: test.method,
          url: `${MOMENTUM_CONFIG.baseURL}${test.endpoint}`,
          headers: headers,
          timeout: 5000
        });

        results.push({
          name: test.name,
          endpoint: test.endpoint,
          status: 'SUCCESS',
          httpStatus: response.status,
          dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
          dataCount: Array.isArray(response.data) ? response.data.length : null,
          sampleData: Array.isArray(response.data) ? 
            response.data.slice(0, 1).map(item => Object.keys(item)) : 
            (typeof response.data === 'object' ? Object.keys(response.data) : null)
        });

      } catch (error) {
        results.push({
          name: test.name,
          endpoint: test.endpoint,
          status: 'ERROR',
          httpStatus: error.response?.status,
          error: error.message,
          errorData: error.response?.data
        });
      }
    }

    // Analizar resultados
    const successfulTests = results.filter(r => r.status === 'SUCCESS');
    const workingEndpoints = successfulTests.map(r => r.endpoint);
    
    res.json({
      success: true,
      totalTests: results.length,
      successfulTests: successfulTests.length,
      workingEndpoints,
      bestEndpoint: successfulTests.find(r => r.dataCount > 0),
      allResults: results,
      recommendations: generateEndpointRecommendations(successfulTests)
    });

  } catch (error) {
    console.error('❌ Error en test de endpoints:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function generateEndpointRecommendations(successfulTests) {
  const recommendations = [];
  
  const assetsEndpoints = successfulTests.filter(t => 
    t.name.toLowerCase().includes('asset') || 
    t.name.toLowerCase().includes('vehicle') ||
    t.name.toLowerCase().includes('fleet')
  );
  
  if (assetsEndpoints.length > 0) {
    const bestAssetEndpoint = assetsEndpoints.find(e => e.dataCount > 0) || assetsEndpoints[0];
    recommendations.push({
      type: 'success',
      message: `Endpoint de assets encontrado: ${bestAssetEndpoint.endpoint}`,
      action: `Usar ${bestAssetEndpoint.endpoint} para obtener lista de trailers`
    });
  } else {
    recommendations.push({
      type: 'warning',
      message: 'No se encontró endpoint funcional para assets/trailers',
      action: 'Contactar a Momentum para confirmar endpoints correctos'
    });
  }
  
  return recommendations;
}

// 🚀 ENDPOINT 2: Obtener ubicación actual de un asset específico (usando locationId)
router.get('/momentum/location/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    console.log(`📍 Obteniendo ubicación actual del asset ${assetId}...`);
    
    // Paso 1: Obtener el asset para conseguir su locationId
    const assetData = await momentumApiCall(`/v1/webapp/tenant/${MOMENTUM_CONFIG.tenantId}/asset`);
    const asset = assetData.find(a => (a.id || a.deviceId) === assetId);
    
    if (!asset || !asset.locationId) {
      return res.status(404).json({
        success: false,
        error: 'Asset no encontrado o sin locationId asignado'
      });
    }
    
    // Paso 2: Obtener la ubicación usando el locationId (endpoint confirmado)
    const locationData = await momentumApiCall(`/v1/webapp/tenant/${MOMENTUM_CONFIG.tenantId}/location/${asset.locationId}`);
    
    // Transformar datos para nuestro frontend
    const transformedLocation = {
      assetId: assetId,
      assetName: asset.name,
      locationId: asset.locationId,
      location: locationData.name || 'Ubicación no disponible',
      coordinates: locationData.coordinates || null, // Formato exacto de Momentum
      address: {
        line1: locationData.line1,
        city: locationData.city,
        state: locationData.state,
        postalCode: locationData.postalCode,
        country: locationData.country
      },
      locationType: locationData.locationType,
      lastUpdate: new Date().toISOString(),
      status: 'ACTIVE'
    };
    
    console.log(`✅ Ubicación obtenida para asset ${assetId}`);
    res.json({
      success: true,
      data: transformedLocation
    });
    
  } catch (error) {
    console.error(`❌ Error obteniendo ubicación del asset ${req.params.assetId}:`, error.message);
    
    // Fallback a datos mock
    const mockLocation = {
      assetId: req.params.assetId,
      location: 'San Juan, PR (Mock)',
      coordinates: { lat: 18.4655, lng: -66.1057 },
      speed: 0,
      direction: 0,
      lastUpdate: new Date().toISOString(),
      status: 'ACTIVE'
    };
    
    res.json({
      success: true,
      data: mockLocation,
      mock: true
    });
  }
});

// 🚀 ENDPOINT 3: Obtener estadísticas de un asset
router.get('/momentum/statistics/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const { startDate, endDate } = req.query;
    
    console.log(`📊 Obteniendo estadísticas del asset ${assetId}...`);
    
    const statisticsData = await momentumApiCall(
      `/v1/tenant/${MOMENTUM_CONFIG.tenantId}/asset/${assetId}/statistics?startDate=${startDate}&endDate=${endDate}`
    );
    
    // Transformar datos para nuestro frontend
    const transformedStats = {
      assetId: assetId,
      totalDistance: statisticsData.totalDistance || 0,
      totalTime: statisticsData.totalTime || 0,
      averageSpeed: statisticsData.averageSpeed || 0,
      maxSpeed: statisticsData.maxSpeed || 0,
      fuelConsumption: statisticsData.fuelConsumption || 0,
      idleTime: statisticsData.idleTime || 0,
      period: {
        startDate: startDate,
        endDate: endDate
      }
    };
    
    console.log(`✅ Estadísticas obtenidas para asset ${assetId}`);
    res.json({
      success: true,
      data: transformedStats
    });
    
  } catch (error) {
    console.error(`❌ Error obteniendo estadísticas del asset ${req.params.assetId}:`, error.message);
    
    // Fallback a datos mock
    const mockStats = {
      assetId: req.params.assetId,
      totalDistance: 150.5,
      totalTime: 8.5,
      averageSpeed: 35.2,
      maxSpeed: 65.0,
      fuelConsumption: 45.2,
      idleTime: 2.1,
      period: {
        startDate: req.query.startDate,
        endDate: req.query.endDate
      }
    };
    
    res.json({
      success: true,
      data: mockStats,
      mock: true
    });
  }
});

// 🚀 ENDPOINT 4: Obtener historial de ubicaciones de un asset
router.get('/momentum/history/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;
    
    console.log(`📅 Obteniendo historial del asset ${assetId}...`);
    
    const historyData = await momentumApiCall(
      `/v1/tenant/${MOMENTUM_CONFIG.tenantId}/asset/${assetId}/location/history?startDate=${startDate}&endDate=${endDate}&limit=${limit}`
    );
    
    // Transformar datos para nuestro frontend
    const transformedHistory = historyData.map(location => ({
      timestamp: location.timestamp,
      coordinates: {
        lat: location.latitude,
        lng: location.longitude
      },
      speed: location.speed || 0,
      direction: location.direction || 0,
      address: location.address || 'Dirección no disponible'
    }));
    
    console.log(`✅ ${transformedHistory.length} registros de historial obtenidos para asset ${assetId}`);
    res.json({
      success: true,
      data: transformedHistory,
      count: transformedHistory.length
    });
    
  } catch (error) {
    console.error(`❌ Error obteniendo historial del asset ${req.params.assetId}:`, error.message);
    
    // Fallback a datos mock
    const mockHistory = [
      {
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        coordinates: { lat: 18.4655, lng: -66.1057 },
        speed: 25,
        direction: 90,
        address: 'San Juan, PR'
      },
      {
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        coordinates: { lat: 18.3985, lng: -66.1614 },
        speed: 0,
        direction: 0,
        address: 'Bayamón, PR'
      }
    ];
    
    res.json({
      success: true,
      data: mockHistory,
      count: mockHistory.length,
      mock: true
    });
  }
});

// Obtener datos GPS reales de Momentum API (endpoint existente actualizado)
router.get('/gps-data', async (req, res) => {
  try {
    console.log('📍 Solicitando datos GPS de trailers desde Momentum API...');
    
    // Usar la nueva función para obtener assets
    const assetsData = await momentumApiCall(`/v1/tenant/${MOMENTUM_CONFIG.tenantId}/asset`);
    
    const realGPSData = [];
    
    // Obtener ubicación actual de cada asset
    for (const asset of assetsData) {
      try {
        const locationData = await momentumApiCall(
          `/v1/webapp/tenant/${MOMENTUM_CONFIG.tenantId}/asset/${asset.id}/trip/current`
        );
        
        realGPSData.push({
          trailer: asset.name,
          assetId: asset.id,
          location: locationData?.currentLocation?.address || 'Ubicación no disponible',
          coordinates: {
            lat: locationData?.latitude || 0,
            lng: locationData?.longitude || 0
          },
          lastUpdate: locationData?.timestamp || new Date().toISOString(),
          status: asset.status?.toUpperCase() || 'UNKNOWN',
          speed: locationData?.speed || 0,
          direction: locationData?.direction || 'N/A'
        });
      } catch (assetError) {
        console.warn(`⚠️ No se pudo obtener ubicación para asset ${asset.name}`);
        realGPSData.push({
          trailer: asset.name,
          assetId: asset.id,
          location: 'No disponible',
          coordinates: { lat: 0, lng: 0 },
          lastUpdate: new Date().toISOString(),
          status: 'OFFLINE',
          speed: 0,
          direction: 'N/A'
        });
      }
    }
    
    console.log(`✅ Datos GPS reales obtenidos para ${realGPSData.length} trailers`);
    res.json({
      success: true,
      data: realGPSData,
      count: realGPSData.length
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo datos de Momentum API, usando datos mock:', error.message);
    
    // Fallback: datos mock si la API no está disponible
    console.log('📍 Usando datos GPS mock (API no disponible)');
    const mockGPSData = [
      {
        trailer: '3-300',
        assetId: 'asset-3300',
        location: 'San Juan, PR',
        coordinates: { lat: 18.4655, lng: -66.1057 },
        lastUpdate: new Date().toISOString(),
        status: 'ACTIVE',
        speed: 0,
        direction: 'N'
      },
      {
        trailer: '3-301',
        assetId: 'asset-3301',
        location: 'Bayamón, PR',
        coordinates: { lat: 18.3985, lng: -66.1614 },
        lastUpdate: new Date().toISOString(),
        status: 'ACTIVE',
        speed: 35,
        direction: 'SE'
      },
      {
        trailer: '1-100',
        assetId: 'asset-1100',
        location: 'Carolina, PR',
        coordinates: { lat: 18.3894, lng: -65.9568 },
        lastUpdate: new Date().toISOString(),
        status: 'MAINTENANCE',
        speed: 0,
        direction: 'N'
      }
    ];
    
    res.json({
      success: true,      data: mockGPSData,
      count: mockGPSData.length,
      mock: true
    });
  }
});

// Obtener destinatarios de email
router.get('/recipients', async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT id, name, email, trailers, active 
      FROM trailer_location_recipients 
      WHERE active = 1
      ORDER BY name
    `);
    
    // Parsear trailers JSON si existe
    const recipients = results.map(recipient => ({
      ...recipient,
      trailers: recipient.trailers ? JSON.parse(recipient.trailers) : []
    }));
    
    console.log(`📧 ${recipients.length} destinatarios cargados`);
    res.json(recipients);
  } catch (error) {
    console.error('❌ Error cargando destinatarios:', error);
    // Devolver datos mock si no existe la tabla
    res.json([
      { id: 1, name: 'Manager Central', email: 'manager@company.com', trailers: ['3-300', '3-301'], active: true },
      { id: 2, name: 'Dispatcher', email: 'dispatch@company.com', trailers: ['1-100', '1-101', '2-01'], active: true }
    ]);
  }
});

// Agregar nuevo destinatario
router.post('/recipients', async (req, res) => {
  const { name, email, trailers, usuario } = req.body;
  
  try {
    const [result] = await db.query(`
      INSERT INTO trailer_location_recipients (name, email, trailers, active)
      VALUES (?, ?, ?, 1)
    `, [name, email, JSON.stringify(trailers || [])]);
    
    const newRecipient = {
      id: result.insertId,
      name,
      email,
      trailers: trailers || [],
      active: true
    };
    
    await logAccion(usuario || 'system', 'CREATE', 'trailer_location_recipients', result.insertId, 
      `Destinatario agregado: ${name} (${email})`);
    
    console.log(`✅ Destinatario agregado: ${name} (${email})`);
    res.json(newRecipient);
  } catch (error) {
    console.error('❌ Error agregando destinatario:', error);
    res.status(500).json({ error: 'Error agregando destinatario' });
  }
});

// Enviar reporte de ubicaciones por email
router.post('/send-report', async (req, res) => {
  const { recipients, reportType, usuario } = req.body;
  
  try {
    console.log(`📧 Enviando reporte de ubicaciones a ${recipients?.length || 0} destinatarios`);
    
    // Obtener datos GPS reales desde Momentum
    let trailerData = [];
    try {
      const assetsData = await momentumApiCall(`/v1/tenant/${MOMENTUM_CONFIG.tenantId}/asset`);
      
      for (const asset of assetsData) {
        try {
          const locationData = await momentumApiCall(
            `/v1/webapp/tenant/${MOMENTUM_CONFIG.tenantId}/asset/${asset.id}/trip/current`
          );
          
          trailerData.push({
            trailer: asset.name,
            assetId: asset.id,
            location: locationData?.currentLocation?.address || 'Ubicación no disponible',
            coordinates: {
              lat: locationData?.latitude || 0,
              lng: locationData?.longitude || 0
            },
            lastUpdate: locationData?.timestamp || new Date().toISOString(),
            status: asset.status?.toUpperCase() || 'UNKNOWN',
            speed: locationData?.speed || 0,
            direction: locationData?.direction || 'N/A'
          });
        } catch (assetError) {
          trailerData.push({
            trailer: asset.name,
            assetId: asset.id,
            location: 'No disponible',
            coordinates: { lat: 0, lng: 0 },
            lastUpdate: new Date().toISOString(),
            status: 'OFFLINE',
            speed: 0,
            direction: 'N/A'
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Error obteniendo datos reales, usando mock data');
      // Usar datos mock como fallback
      trailerData = [
        {
          trailer: '3-300',
          location: 'San Juan, PR',
          coordinates: { lat: 18.4655, lng: -66.1057 },
          lastUpdate: new Date().toISOString(),
          status: 'ACTIVE',
          speed: 0,
          direction: 'N'
        },
        {
          trailer: '3-301',
          location: 'Bayamón, PR',
          coordinates: { lat: 18.3985, lng: -66.1614 },
          lastUpdate: new Date().toISOString(),
          status: 'ACTIVE',
          speed: 35,
          direction: 'SE'
        }
      ];
    }
    
    console.log(`📍 Datos obtenidos para ${trailerData.length} trailers`);
    
    // Filtrar trailers por destinatario si es necesario
    const recipientList = recipients || [];
    
    // Generar contenido del email
    const emailContent = generateLocationReportHTML(trailerData, reportType || 'daily');
    
    // Enviar emails reales usando nodemailer
    const emailPromises = recipientList.map(async (recipient) => {
      try {
        console.log(`📤 Enviando a: ${recipient.name} (${recipient.email})`);
        
        const mailOptions = {
          from: process.env.SMTP_USER || 'noreply@company.com',
          to: recipient.email,
          subject: `📍 Reporte de Ubicación de Trailers - ${new Date().toLocaleDateString('es-ES')}`,
          html: emailContent
        };
        
        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`✅ Email enviado a ${recipient.email}:`, info.messageId);
        return { success: true, recipient: recipient.email, messageId: info.messageId };
        
      } catch (emailError) {
        console.error(`❌ Error enviando email a ${recipient.email}:`, emailError.message);
        return { success: false, recipient: recipient.email, error: emailError.message };
      }
    });
    
    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    // Registrar en audit log
    await logAccion(usuario || 'system', 'EMAIL_SENT', 'trailer_location_reports', null,
      `Reporte enviado: ${successCount} exitosos, ${failureCount} fallidos, ${trailerData.length} trailers`);
    
    res.json({ 
      success: true, 
      message: `Reporte enviado a ${successCount}/${recipientList.length} destinatarios`,
      timestamp: new Date().toISOString(),
      results: results,
      trailersIncluded: trailerData.length
    });
    
  } catch (error) {
    console.error('❌ Error enviando reporte:', error.message);
    res.status(500).json({ error: 'Error enviando reporte', details: error.message });
  }
});

// Función para generar contenido HTML del reporte
function generateLocationReport(trailerData) {
  const timestamp = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let tableRows = '';
  trailerData.forEach(trailer => {
    const statusColor = trailer.status === 'ACTIVE' ? '#4caf50' : 
                       trailer.status === 'MAINTENANCE' ? '#ff9800' : '#f44336';
    
    tableRows += `
      <tr>
        <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; color: #1976d2;">${trailer.trailer}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">📍 ${trailer.location}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">
          <span style="padding: 4px 8px; border-radius: 12px; background: ${statusColor}; color: white; font-size: 12px;">
            ${trailer.status}
          </span>
        </td>
        <td style="padding: 12px; border: 1px solid #ddd; font-size: 14px; color: #666;">
          ${new Date(trailer.lastUpdate).toLocaleString('es-ES')}
        </td>
      </tr>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reporte de Ubicación de Trailers</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
      <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(90deg, #ff9800, #f57c00); color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🛰️ REPORTE DE UBICACIÓN DE TRAILERS</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Generado el ${timestamp}</p>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            A continuación se presenta el reporte actualizado de ubicaciones de todos los trailers activos:
          </p>

          <!-- Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left; color: #333; font-weight: bold;">Trailer</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left; color: #333; font-weight: bold;">Ubicación</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left; color: #333; font-weight: bold;">Estado</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left; color: #333; font-weight: bold;">Última Actualización</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <!-- Summary -->
          <div style="background: #e3f2fd; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 8px 0; color: #1976d2;">📊 Resumen:</h3>
            <p style="margin: 4px 0; color: #333;"><strong>Total de trailers:</strong> ${trailerData.length}</p>
            <p style="margin: 4px 0; color: #333;"><strong>Activos:</strong> ${trailerData.filter(t => t.status === 'ACTIVE').length}</p>
            <p style="margin: 4px 0; color: #333;"><strong>En mantenimiento:</strong> ${trailerData.filter(t => t.status === 'MAINTENANCE').length}</p>
            <p style="margin: 4px 0; color: #333;"><strong>Inactivos:</strong> ${trailerData.filter(t => t.status === 'INACTIVE').length}</p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; color: #666; font-size: 14px; border-top: 1px solid #eee; padding-top: 16px;">
            <p>Este reporte fue generado automáticamente por el Sistema de Gestión de Trailers</p>
            <p>Para consultas contacte al departamento de operaciones</p>
          </div>
        </div>
      </div>
    </body>    </html>
  `;
}

// Generar reporte HTML personalizado para envío por email
function generateLocationReportHTML(trailerData, reportType, recipientName = '') {
  const currentDate = new Date().toLocaleDateString();
  const currentTime = new Date().toLocaleTimeString();
  
  const trailersHTML = trailerData.map(trailer => `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; color: #1976d2;">
        ${trailer.trailer}
      </td>
      <td style="padding: 12px; border: 1px solid #ddd;">
        📍 ${trailer.location}
      </td>
      <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
        <span style="padding: 4px 8px; border-radius: 12px; font-size: 12px; color: white; background: ${getStatusColor(trailer.status)};">
          ${trailer.status}
        </span>
      </td>
      <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
        ${trailer.speed || 0} mph
      </td>
      <td style="padding: 12px; border: 1px solid #ddd; font-size: 12px; color: #666;">
        ${new Date(trailer.lastUpdate).toLocaleString()}
      </td>
    </tr>
  `).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reporte de Ubicación de Trailers</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
      <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <div style="background: linear-gradient(90deg, #ff9800, #f57c00); color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🛰️ REPORTE DE UBICACIÓN DE TRAILERS</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">
            ${recipientName ? `Para: ${recipientName} | ` : ''}Generado el ${currentDate} a las ${currentTime}
          </p>
        </div>
        
        <div style="padding: 24px;">
          <div style="margin-bottom: 20px; padding: 16px; background: #e3f2fd; border-radius: 6px; border-left: 4px solid #1976d2;">
            <h3 style="margin: 0 0 8px 0; color: #1976d2;">📋 Resumen del Reporte</h3>
            <p style="margin: 0; color: #666;">
              Total de trailers reportados: <strong>${trailerData.length}</strong><br>
              Tipo de reporte: <strong>${reportType === 'location_update' ? 'Actualización de Ubicación' : 'Reporte Manual'}</strong><br>
              Proveedor GPS: <strong>Momentum IoT</strong>
            </p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background: #ff9800; color: white;">
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Trailer</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Ubicación</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">Estado</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">Velocidad</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">Última Actualización</th>
              </tr>
            </thead>
            <tbody>
              ${trailersHTML}
            </tbody>
          </table>
          
          <div style="margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 6px; text-align: center; font-size: 12px; color: #666;">
            <p style="margin: 0;">
              🛰️ Este reporte fue generado automáticamente por el sistema GPS integrado con Momentum IoT.<br>
              📱 Para soporte técnico o configuración de alertas, contacte al administrador del sistema.<br>
              🔒 Información confidencial - Solo para uso autorizado.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getStatusColor(status) {
  switch (status) {
    case 'ACTIVE': return '#4caf50';
    case 'INACTIVE': return '#f44336';
    case 'MAINTENANCE': return '#ff9800';
    case 'OFFLINE': return '#666';
    default: return '#9e9e9e';
  }
}

// Programar envío automático usando cron jobs
if (process.env.NODE_ENV === 'production') {
  // Envío diario a las 8:00 AM
  const cronSchedule = require('node-cron');
  
  cronSchedule.schedule('0 8 * * *', async () => {
    try {
      console.log('🕐 Ejecutando envío automático de ubicaciones (8:00 AM)...');
      
      // Obtener configuración de envío automático
      const [scheduleConfig] = await db.query(
        'SELECT * FROM trailer_location_schedule WHERE enabled = 1 ORDER BY updated_at DESC LIMIT 1'
      );
      
      if (scheduleConfig.length === 0) {
        console.log('ℹ️ No hay configuración de envío automático habilitada');
        return;
      }
      
      const recipients = JSON.parse(scheduleConfig[0].recipients);
      
      // Obtener ubicaciones actuales usando Momentum API
      const token = await authenticateMomentum();
      if (token) {
        const assetsResponse = await axios.get(
          `${MOMENTUM_CONFIG.baseURL}/v1/tenant/${MOMENTUM_CONFIG.tenantId}/asset`,
          { headers: MOMENTUM_CONFIG.headers }
        );
        
        const trailerData = [];
        for (const asset of assetsResponse.data) {
          try {
            const tripResponse = await axios.get(
              `${MOMENTUM_CONFIG.baseURL}/v1/webapp/tenant/${MOMENTUM_CONFIG.tenantId}/asset/${asset.id}/trip/current`,
              { headers: MOMENTUM_CONFIG.headers }
            );
            
            trailerData.push({
              trailer: asset.name,
              location: tripResponse.data?.currentLocation?.address || 'Ubicación no disponible',
              status: asset.operatingStatus?.toUpperCase() || 'UNKNOWN',
              speed: tripResponse.data?.currentSpeed || 0,
              lastUpdate: new Date().toISOString()
            });
          } catch (err) {
            console.warn(`⚠️ Error obteniendo datos para ${asset.name}:`, err.message);
          }
        }
        
        // Enviar reporte automático
        const reportHTML = generateLocationReportHTML(trailerData, 'automatic_daily');
        
        for (const recipient of recipients) {
          try {
            await emailTransporter.sendMail({
              from: process.env.SMTP_USER,
              to: recipient.email,
              subject: `📍 Reporte Diario de Ubicación de Trailers - ${new Date().toLocaleDateString()}`,
              html: reportHTML
            });
            console.log(`✅ Reporte automático enviado a ${recipient.email}`);
          } catch (emailError) {
            console.error(`❌ Error enviando a ${recipient.email}:`, emailError);
          }
        }
        
        await logAccion('system', 'SEND', 'trailer_location_report', null,
          `Reporte automático enviado a ${recipients.length} destinatarios`);
        
        console.log('✅ Envío automático completado');
      }
    } catch (error) {
      console.error('❌ Error en envío automático:', error);
    }
  });
  
  console.log('⏰ Programación de envío automático iniciada (8:00 AM diario)');
}

// 🚛 ENDPOINTS PARA GESTIÓN DE TRAILERS LOCALES

// Obtener todos los trailers desde la base de datos local
router.get('/trailers', async (req, res) => {
  try {
    console.log('📋 Obteniendo lista de trailers desde base de datos local...');
    
    const [trailers] = await db.query(`
      SELECT 
        id,
        trailer_number,
        asset_id,
        status,
        last_known_location,
        last_latitude,
        last_longitude,
        last_update,
        notes
      FROM trailers 
      ORDER BY trailer_number
    `);
    
    const transformedTrailers = trailers.map(trailer => ({
      id: trailer.id,
      trailer: trailer.trailer_number,
      assetId: trailer.asset_id,
      status: trailer.status,
      location: trailer.last_known_location || 'Ubicación no disponible',
      coordinates: {
        lat: trailer.last_latitude || 0,
        lng: trailer.last_longitude || 0
      },
      lastUpdate: trailer.last_update,
      notes: trailer.notes
    }));
    
    console.log(`✅ ${transformedTrailers.length} trailers obtenidos desde BD local`);
    res.json({
      success: true,
      data: transformedTrailers,
      count: transformedTrailers.length
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo trailers desde BD:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Error obteniendo trailers de la base de datos',
      details: error.message 
    });
  }
});

// Agregar nuevo trailer
router.post('/trailers', async (req, res) => {
  const { trailer_number, asset_id, status, location, coordinates, notes, usuario } = req.body;
  
  try {
    console.log(`➕ Agregando nuevo trailer: ${trailer_number}`);
    
    const [result] = await db.query(`
      INSERT INTO trailers (
        trailer_number, 
        asset_id, 
        status, 
        last_known_location, 
        last_latitude, 
        last_longitude,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      trailer_number,
      asset_id || `asset-${trailer_number}`,
      status || 'ACTIVE',
      location || 'Ubicación no disponible',
      coordinates?.lat || 0,
      coordinates?.lng || 0,
      notes || ''
    ]);
    
    const newTrailer = {
      id: result.insertId,
      trailer: trailer_number,
      assetId: asset_id || `asset-${trailer_number}`,
      status: status || 'ACTIVE',
      location: location || 'Ubicación no disponible',
      coordinates: coordinates || { lat: 0, lng: 0 },
      lastUpdate: new Date().toISOString(),
      notes: notes || ''
    };
    
    await logAccion(usuario || 'system', 'CREATE', 'trailers', result.insertId, 
      `Trailer agregado: ${trailer_number}`);
    
    console.log(`✅ Trailer ${trailer_number} agregado exitosamente`);
    res.json({
      success: true,
      data: newTrailer
    });
    
  } catch (error) {
    console.error('❌ Error agregando trailer:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Error agregando trailer',
      details: error.message 
    });
  }
});

// Actualizar ubicación de un trailer
router.put('/trailers/:id/location', async (req, res) => {
  const { id } = req.params;
  const { location, coordinates, status, usuario } = req.body;
  
  try {
    console.log(`📍 Actualizando ubicación del trailer ID: ${id}`);
    
    await db.query(`
      UPDATE trailers 
      SET 
        last_known_location = ?,
        last_latitude = ?,
        last_longitude = ?,
        status = ?,
        last_update = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      location,
      coordinates?.lat || 0,
      coordinates?.lng || 0,
      status || 'ACTIVE',
      id
    ]);
    
    // Insertar en historial
    await db.query(`
      INSERT INTO trailer_location_history (
        trailer_id, latitude, longitude, address
      ) VALUES (?, ?, ?, ?)
    `, [id, coordinates?.lat || 0, coordinates?.lng || 0, location]);
    
    await logAccion(usuario || 'system', 'UPDATE', 'trailers', id, 
      `Ubicación actualizada: ${location}`);
    
    console.log(`✅ Ubicación actualizada para trailer ID: ${id}`);
    res.json({
      success: true,
      message: 'Ubicación actualizada exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error actualizando ubicación:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Error actualizando ubicación',
      details: error.message 
    });
  }
});

// Eliminar trailer
router.delete('/trailers/:id', async (req, res) => {
  const { id } = req.params;
  const { usuario } = req.body;
  
  try {
    console.log(`🗑️ Eliminando trailer ID: ${id}`);
    
    // Obtener info del trailer antes de eliminar
    const [trailer] = await db.query('SELECT trailer_number FROM trailers WHERE id = ?', [id]);
    
    await db.query('DELETE FROM trailers WHERE id = ?', [id]);
    
    await logAccion(usuario || 'system', 'DELETE', 'trailers', id, 
      `Trailer eliminado: ${trailer[0]?.trailer_number || id}`);
    
    console.log(`✅ Trailer ID ${id} eliminado exitosamente`);
    res.json({
      success: true,
      message: 'Trailer eliminado exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error eliminando trailer:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Error eliminando trailer',
      details: error.message 
    });
  }
});

module.exports = router;
