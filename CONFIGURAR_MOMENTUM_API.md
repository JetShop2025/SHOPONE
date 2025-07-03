# 🔧 CONFIGURACIÓN DE MOMENTUM GPS API

## ❌ PROBLEMA ACTUAL
El sistema muestra "USANDO DATOS DE PRUEBA - API DE MOMENTUM NO DISPONIBLE" porque no están configuradas las credenciales reales de Momentum.

## ✅ SOLUCIÓN PASO A PASO

### **PASO 1: Obtener Credenciales de Momentum**

Necesitas contactar a Momentum GPS para obtener:

1. **Credenciales de Autenticación** (una de estas opciones):
   - `Username` y `Password` de tu cuenta Momentum
   - `JWT Token` proporcionado por Momentum
   - `API Key` (si utilizan este método)

2. **Información de Tenant**:
   - `Tenant ID` - Identificador único de tu organización en Momentum

3. **URL de la API**:
   - URL base de la API (por defecto: `https://api.momentum.com`)
   - Verificar con Momentum si es la URL correcta

### **PASO 2: Configurar Variables de Entorno**

#### **Para Deploy en Render:**
1. Ve a tu dashboard de Render → shopone.onrender.com
2. Navega a "Environment" 
3. Agrega estas variables:

```bash
# CREDENCIALES DE MOMENTUM
MOMENTUM_TENANT_ID=tu-tenant-id-aqui
MOMENTUM_USERNAME=tu-usuario-momentum
MOMENTUM_PASSWORD=tu-password-momentum

# ALTERNATIVAMENTE (si Momentum te da un JWT):
MOMENTUM_JWT_TOKEN=tu-jwt-token-aqui

# URL DE LA API (verificar con Momentum)
MOMENTUM_BASE_URL=https://api.momentum.com
```

#### **Para Testing Local:**
1. Copia el archivo `.env.example` a `.env` en el directorio `backend/`
2. Edita el archivo `.env` con tus credenciales reales:

```bash
# Copia de .env.example a .env
cp backend/.env.example backend/.env
```

```bash
# Editar backend/.env
MOMENTUM_TENANT_ID=tu-tenant-id-real
MOMENTUM_USERNAME=tu-usuario-real
MOMENTUM_PASSWORD=tu-password-real
MOMENTUM_BASE_URL=https://api.momentum.com
```

### **PASO 3: Verificar Configuración**

#### **Método 1: Endpoint de Diagnóstico**
Accede a: `https://shopone.onrender.com/api/trailer-location/momentum/diagnostics`

Este endpoint te dirá:
- ✅ Qué credenciales están configuradas
- ✅ Si puede autenticar con Momentum
- ✅ Si puede acceder a la API
- ⚠️ Recomendaciones para solucionar problemas

#### **Método 2: Página de Pruebas**
Usa la página: `test-momentum-trailers.html`
- Test de conectividad
- Carga de assets reales
- Diagnóstico visual

### **PASO 4: Reiniciar Servicios**

#### **En Render:**
1. Ve a tu dashboard de Render
2. Click en "Manual Deploy" o espera el deploy automático
3. El sistema reiniciará con las nuevas variables

#### **Localmente:**
```bash
# Reiniciar el servidor backend
cd backend
npm start
```

### **PASO 5: Validar Funcionamiento**

1. **Verificar Logs del Backend:**
   - Busca: `🔐 Verificando credenciales de Momentum`
   - Debe mostrar ✅ para las credenciales configuradas

2. **Probar el Frontend:**
   - Accede al módulo "Trailer Location"
   - El mensaje debe cambiar de "datos de prueba" a datos reales
   - Los trailers mostrados deben ser los reales de tu flota

---

## 🔍 DIAGNÓSTICO DE PROBLEMAS

### **Mensaje: "No hay credenciales de Momentum configuradas"**
**Solución:** Configura al menos una de estas variables:
- `MOMENTUM_TENANT_ID` + `MOMENTUM_USERNAME` + `MOMENTUM_PASSWORD`
- `MOMENTUM_TENANT_ID` + `MOMENTUM_JWT_TOKEN`
- `MOMENTUM_TENANT_ID` + `MOMENTUM_API_KEY`

### **Mensaje: "Error autenticando con Momentum"**
**Posibles causas:**
1. Credenciales incorrectas (usuario/password)
2. URL base incorrecta
3. Problema de conectividad con Momentum

**Solución:**
1. Verificar credenciales con Momentum
2. Probar URL alternativa si la proporcionan
3. Verificar que Render pueda acceder a la API de Momentum

### **Mensaje: "Autenticación exitosa pero no se puede acceder a la API"**
**Posibles causas:**
1. Tenant ID incorrecto
2. Permisos insuficientes en la cuenta Momentum
3. Formato de endpoints incorrecto

**Solución:**
1. Verificar Tenant ID con Momentum
2. Solicitar permisos de acceso a assets/trailers
3. Confirmar estructura de endpoints con Momentum

---

## 📞 CONTACTO CON MOMENTUM

### **Información a Solicitar:**

1. **Credenciales de API:**
   ```
   - URL base de la API
   - Tenant ID de tu organización
   - Método de autenticación preferido (username/password vs JWT vs API key)
   - Credenciales específicas para tu cuenta
   ```

2. **Documentación de Endpoints:**
   ```
   - GET /v1/tenant/{tenantId}/asset (lista de assets)
   - GET /v1/webapp/tenant/{tenantId}/asset/{assetId}/trip/current (ubicación actual)
   - Formato de respuestas esperadas
   ```

3. **Permisos Necesarios:**
   ```
   - Acceso de lectura a assets/trailers
   - Acceso a ubicaciones GPS en tiempo real
   - Cualquier configuración especial requerida
   ```

### **Email Template para Momentum:**
```
Asunto: Configuración de API para integración de sistema de gestión

Hola,

Estamos integrando nuestro sistema de gestión de trailers con la API de Momentum GPS.

Necesitamos la siguiente información para completar la integración:

1. URL base de la API de Momentum
2. Tenant ID de nuestra organización
3. Credenciales de autenticación (username/password, JWT token, o API key)
4. Documentación de los endpoints para:
   - Obtener lista de todos nuestros assets/trailers
   - Obtener ubicación GPS actual de un asset específico

Actualmente estamos probando con datos de prueba, pero necesitamos acceso a los datos reales para producción.

¿Podrían proporcionar esta información y cualquier documentación adicional?

Gracias,
[Tu nombre y empresa]
```

---

## 🚀 RESULTADO ESPERADO

Una vez configurado correctamente:

1. **✅ Sin mensaje de "datos de prueba"**
2. **✅ Lista real de tus trailers/assets de Momentum**
3. **✅ Ubicaciones GPS actualizadas en tiempo real**
4. **✅ Envío de correos con ubicaciones reales**
5. **✅ Sistema completamente funcional con datos de producción**

El sistema pasará automáticamente de datos mock a datos reales cuando detecte credenciales válidas.
