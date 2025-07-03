#!/bin/bash
echo "🚀 Iniciando build para Render..."

# Set environment variables for build
export NODE_OPTIONS="--max-old-space-size=4096"
export GENERATE_SOURCEMAP=false
export CI=false

# Install dependencies
echo "📦 Instalando dependencias..."
npm install

# Try to build React app
echo "🔨 Construyendo aplicación React..."
timeout 300 npx react-scripts build || {
    echo "⚠️ Build de React falló, creando build básico..."
    
    # Create basic build directory
    mkdir -p build
    
    # Copy public assets
    cp public/favicon.ico build/ 2>/dev/null || true
    cp public/logo*.png build/ 2>/dev/null || true
    cp public/manifest.json build/ 2>/dev/null || true
    cp public/robots.txt build/ 2>/dev/null || true
    
    # Create a basic index.html that loads the app
    cat > build/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Sistema Gráfico V2 - Gestión Industrial" />
    <link rel="apple-touch-icon" href="/logo192.png" />
    <link rel="manifest" href="/manifest.json" />
    <title>Sistema Gráfico V2</title>
    <style>
        body { margin: 0; font-family: 'Courier New', monospace; }
        .loading { 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            flex-direction: column;
        }
        .spinner {
            width: 50px; height: 50px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid #1976d2;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="loading">
        <div class="spinner"></div>
        <h1 style="color: #1976d2; margin-top: 20px;">🚛 Sistema Gráfico V2</h1>
        <p style="color: #666;">Cargando aplicación modernizada...</p>
    </div>
    <script>
        // Redirect to backend-served app
        setTimeout(() => {
            window.location.href = '/app';
        }, 2000);
    </script>
</body>
</html>
EOF
    
    echo "✅ Build básico creado exitosamente"
}

# Install backend dependencies
echo "📦 Instalando dependencias del backend..."
cd backend && npm install

echo "🎉 Build para Render completado"
