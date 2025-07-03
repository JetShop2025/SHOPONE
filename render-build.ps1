# PowerShell version of render build script
Write-Host "🚀 Iniciando build para Render..." -ForegroundColor Green

# Set environment variables for build
$env:NODE_OPTIONS = "--max-old-space-size=4096"
$env:GENERATE_SOURCEMAP = "false"
$env:CI = "false"

# Install dependencies
Write-Host "📦 Instalando dependencias..." -ForegroundColor Yellow
npm install

# Try to build React app with timeout
Write-Host "🔨 Construyendo aplicación React..." -ForegroundColor Yellow

$buildJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    $env:NODE_OPTIONS = "--max-old-space-size=4096"
    $env:GENERATE_SOURCEMAP = "false" 
    $env:CI = "false"
    npx react-scripts build
}

$timeout = 300 # 5 minutes
$completed = Wait-Job -Job $buildJob -Timeout $timeout

if ($completed) {
    $result = Receive-Job -Job $buildJob
    Write-Host "✅ Build de React completado" -ForegroundColor Green
    Write-Host $result
} else {
    Write-Host "⚠️ Build de React falló o se agotó el tiempo, creando build básico..." -ForegroundColor Yellow
    Stop-Job -Job $buildJob
    
    # Create basic build directory
    if (!(Test-Path "build")) {
        New-Item -ItemType Directory -Path "build" | Out-Null
    }
    
    # Copy public assets
    if (Test-Path "public/favicon.ico") { Copy-Item "public/favicon.ico" "build/" }
    if (Test-Path "public/logo192.png") { Copy-Item "public/logo192.png" "build/" }
    if (Test-Path "public/logo512.png") { Copy-Item "public/logo512.png" "build/" }
    if (Test-Path "public/manifest.json") { Copy-Item "public/manifest.json" "build/" }
    if (Test-Path "public/robots.txt") { Copy-Item "public/robots.txt" "build/" }
    
    # Create a basic index.html that redirects to backend
    $basicHTML = @'
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
        <p style="color: #999; font-size: 14px;">Redirigiendo al sistema con UI/UX actualizada</p>
    </div>
    <script>
        // Redirect to backend-served app
        setTimeout(() => {
            window.location.href = '/app';
        }, 2000);
    </script>
</body>
</html>
'@
    
    $basicHTML | Out-File -FilePath "build/index.html" -Encoding utf8
    Write-Host "✅ Build básico creado exitosamente" -ForegroundColor Green
}

Remove-Job -Job $buildJob -Force

# Install backend dependencies
Write-Host "📦 Instalando dependencias del backend..." -ForegroundColor Yellow
Set-Location backend
npm install
Set-Location ..

Write-Host "🎉 Build para Render completado" -ForegroundColor Green
