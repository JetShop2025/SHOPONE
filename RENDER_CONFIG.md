# Render.com Configuration Guide

## 1. Build Command:
```
npm run build
```

## 2. Start Command:
```
npm start
```

## 3. Environment Variables (add these in Render dashboard):
- MYSQL_HOST=hopper.proxy.rlwy.net
- MYSQL_USER=root
- MYSQL_PASSWORD=OlsfWGeoaeIWAdyVFRoEMzDUfUqgipRA
- MYSQL_DATABASE=railway
- MYSQL_PORT=30323
- NODE_ENV=production

## 4. Service Type:
Web Service

## 5. Root Directory:
/ (root of repository)

## 6. Auto-Deploy:
Yes (recommended)

## Notes:
- The app will serve both frontend (React) and backend (Express)
- Database is hosted on Railway
- CORS is configured for production
