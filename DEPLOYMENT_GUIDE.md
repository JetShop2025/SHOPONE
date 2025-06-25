# 🚀 DEPLOYMENT GUIDE - RENDER

## ✅ Estado actual del código:
- ✅ Servidor configurado para producción
- ✅ CORS configurado correctamente  
- ✅ Variables de entorno configuradas
- ✅ Scripts de build y start actualizados
- ✅ Dependencias del backend agregadas al package.json principal
- ✅ workOrders.js simplificado y estable

## 📋 PASOS PARA DEPLOY EN RENDER:

### 1. Subir código a GitHub/GitLab
Asegúrate de que todos los cambios estén committeados y pusheados.

### 2. Configurar en Render:
- **Service Type:** Web Service
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Root Directory:** `/` (root del repositorio)

### 3. Variables de entorno en Render:
```
MYSQL_HOST=hopper.proxy.rlwy.net
MYSQL_USER=root
MYSQL_PASSWORD=OlsfWGeoaeIWAdyVFRoEMzDUfUqgipRA
MYSQL_DATABASE=railway
MYSQL_PORT=30323
NODE_ENV=production
```

### 4. Verificar después del deploy:
- `https://tu-app.onrender.com/health` → Debe mostrar status OK
- `https://tu-app.onrender.com/test-db` → Debe conectar a Railway
- `https://tu-app.onrender.com/work-orders` → Debe mostrar las órdenes

## 🔗 URLs importantes:
- Frontend: `https://tu-app.onrender.com`
- API Health: `https://tu-app.onrender.com/health`
- Work Orders: `https://tu-app.onrender.com/work-orders`

## 📊 Arquitectura final:
```
Frontend (React) + Backend (Express) → Render
                    ↓
Database (MySQL) → Railway
```

## ⚠️ Notas importantes:
1. Render puede tardar unos minutos en hacer el primer deploy
2. El servicio puede "dormir" si no recibe tráfico por un tiempo
3. La primera conexión después de dormir puede ser lenta
4. Todas las rutas del frontend se sirven desde el mismo dominio que el backend
