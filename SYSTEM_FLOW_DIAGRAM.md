# 🏗️ DIAGRAMA DE FLUJO DEL SISTEMA JET SHOP

## 📋 ARQUITECTURA GENERAL

```mermaid
graph TB
    subgraph "🌐 FRONTEND - React/TypeScript"
        A[Login Form] --> B[Menu Principal]
        B --> C[Work Orders]
        B --> D[Inventory]
        B --> E[Trailers]
        B --> F[Audit Log]
    end
    
    subgraph "🔧 BACKEND - Node.js/Express"
        G[API Server :5050]
        H[MySQL Database]
        I[PDF Generator]
        J[FIFO System]
    end
    
    subgraph "☁️ DEPLOYMENT"
        K[Render.com]
        L[GitHub Repo]
    end
    
    A --> G
    C --> G
    D --> G
    E --> G
    F --> G
    G --> H
    G --> I
    G --> J
    L --> K
    K --> G
```

## 🔄 FLUJO PRINCIPAL - WORK ORDERS

```mermaid
flowchart TD
    Start([👤 Usuario inicia sesión]) --> Login{🔐 Verificar credenciales}
    Login -->|✅ Válido| Menu[📋 Menú Principal]
    Login -->|❌ Inválido| Start
    
    Menu --> WO[🛠️ Work Orders]
    WO --> Choice{¿Qué acción?}
    
    Choice -->|📝 Crear nueva| CreateWO[📝 Crear Work Order]
    Choice -->|✏️ Editar| EditWO[✏️ Editar Work Order]
    Choice -->|👁️ Ver PDF| ViewPDF[📄 Ver PDF]
    Choice -->|🗑️ Eliminar| DeleteWO[🗑️ Eliminar Work Order]
    
    subgraph "📝 PROCESO CREAR WORK ORDER"
        CreateWO --> Form1[📋 Llenar formulario]
        Form1 --> Customer[🏢 Seleccionar Customer]
        Customer --> Trailer[🚛 Seleccionar/Escribir Trailer]
        Trailer --> Mechanics[👷 Agregar Mecánicos]
        Mechanics --> Parts[🔧 Agregar Partes]
        
        subgraph "🔧 AUTOCOMPLETADO PARTES"
            Parts --> SearchSKU[🔍 Buscar SKU en inventario]
            SearchSKU --> Found{¿Encontrado?}
            Found -->|✅ Sí| AutoFill[✨ Auto-completar nombre y precio]
            Found -->|❌ No| Manual[✋ Entrada manual]
            AutoFill --> SetQty[📊 Establecer cantidad]
            Manual --> SetQty
            SetQty --> CalcTotal[💰 Calcular total automático]
        end
        
        CalcTotal --> Submit[💾 Enviar formulario]
    end
    
    subgraph "⚙️ PROCESAMIENTO BACKEND"
        Submit --> Validate[✅ Validar datos]
        Validate --> SaveDB[💾 Guardar en BD]
        SaveDB --> Response[📤 Respuesta inmediata]
        Response --> Background[🔄 Proceso en segundo plano]
        
        subgraph "🔄 PROCESO FIFO (Asíncrono)"
            Background --> FIFO1[📦 Buscar receives disponibles]
            FIFO1 --> FIFO2[📉 Descontar qty_remaining]
            FIFO2 --> FIFO3[📝 Registrar en work_order_parts]
            FIFO3 --> FIFO4[🔗 Vincular invoice links]
        end
        
        subgraph "📄 GENERACIÓN PDF (Asíncrono)"
            FIFO4 --> PDF1[📋 Obtener datos completos]
            PDF1 --> PDF2[🎨 Generar PDF profesional]
            PDF2 --> PDF3[💾 Guardar PDF en BD]
            PDF3 --> PDF4[🧹 Limpiar memoria]
        end
    end
    
    PDF4 --> Success[✅ Work Order creada]
    Success --> WO
```

## 📦 FLUJO SISTEMA FIFO

```mermaid
flowchart TD
    StartFIFO([🔧 Parte agregada a WO]) --> CheckInventory[📦 Buscar en receives]
    CheckInventory --> HasStock{¿Hay stock disponible?}
    
    HasStock -->|✅ Sí| ProcessFIFO[🔄 Procesamiento FIFO]
    HasStock -->|❌ No| NoStock[⚠️ Sin stock - Solo registro]
    
    subgraph "🔄 PROCESAMIENTO FIFO"
        ProcessFIFO --> GetOldest[📅 Obtener receive más antiguo]
        GetOldest --> CalcDeduct[🔢 Calcular qty a descontar]
        CalcDeduct --> MinQty[📊 Min(qty_needed, qty_available)]
        MinQty --> UpdateReceive[📉 Actualizar qty_remaining]
        UpdateReceive --> RegisterPart[📝 Registrar en work_order_parts]
        RegisterPart --> StillNeeded{¿Aún necesita más qty?}
        StillNeeded -->|✅ Sí| GetOldest
        StillNeeded -->|❌ No| CompleteFIFO[✅ FIFO Completado]
    end
    
    NoStock --> RegisterOnly[📝 Solo registrar sin descuento]
    RegisterOnly --> CompleteFIFO
    CompleteFIFO --> PDFGeneration[📄 Incluir en PDF con links]
```

## 📄 FLUJO GENERACIÓN PDF

```mermaid
flowchart TD
    StartPDF([📄 Generar PDF]) --> GetData[📊 Obtener datos WO]
    GetData --> GetFIFO[🔗 Obtener datos FIFO]
    GetFIFO --> InitPDF[🎨 Inicializar PDFDocument]
    
    subgraph "🎨 DISEÑO PDF"
        InitPDF --> Header[📋 Header con logo y título INVOICE]
        Header --> Customer[🏢 Información del cliente]
        Customer --> WODetails[🛠️ Detalles Work Order]
        WODetails --> Description[📝 Descripción del trabajo]
        Description --> PartsTable[📊 Tabla de partes con enlaces FIFO]
        PartsTable --> Financial[💰 Resumen financiero]
        Financial --> Terms[📜 Términos y condiciones]
    end
    
    Terms --> SavePDF[💾 Guardar PDF en BD]
    SavePDF --> Cleanup[🧹 Limpiar memoria]
    Cleanup --> PDFReady[✅ PDF Listo]
```

## 🔍 FLUJO AUTOCOMPLETADO

```mermaid
flowchart TD
    TypeSKU[⌨️ Usuario escribe SKU] --> SearchInv[🔍 Buscar en inventario]
    SearchInv --> ExactMatch{¿Coincidencia exacta?}
    
    ExactMatch -->|✅ Sí| UseExact[✨ Usar coincidencia exacta]
    ExactMatch -->|❌ No| PartialMatch{¿Coincidencia parcial?}
    
    PartialMatch -->|✅ Sí| UsePartial[⚠️ Usar coincidencia parcial]
    PartialMatch -->|❌ No| NoMatch[❌ Sin coincidencias]
    
    UseExact --> ExtractData[📊 Extraer datos parte]
    UsePartial --> ExtractData
    
    subgraph "📊 EXTRACCIÓN DATOS"
        ExtractData --> GetName[📝 part || description || name]
        GetName --> GetPrice[💰 precio || cost || price]
        GetPrice --> FormatCost[🔢 Formatear costo a 2 decimales]
    end
    
    FormatCost --> AutoFill[✨ Auto-llenar campos]
    AutoFill --> Visual[💚 Feedback visual verde]
    NoMatch --> Manual[✋ Entrada manual requerida]
```

## 🗄️ ESTRUCTURA BASE DE DATOS

```mermaid
erDiagram
    WORK_ORDERS {
        int id PK
        string billToCo
        string trailer
        string mechanic
        json mechanics
        date date
        text description
        json parts
        float totalHrs
        float totalLabAndParts
        string status
        int idClassic
        json extraOptions
        blob pdf_file
    }
    
    INVENTORY {
        string sku PK
        string barCodes
        string category
        string part
        string provider
        string brand
        string um
        string area
        int onHand
        string imagen
        float precio
        string usuario
        string invoiceLink
    }
    
    RECEIVES {
        int id PK
        string sku FK
        int qty_remaining
        date fecha
        string invoice
        string invoiceLink
    }
    
    WORK_ORDER_PARTS {
        int id PK
        int work_order_id FK
        string sku FK
        string part_name
        int qty_used
        float cost
        string invoice
        string invoiceLink
        string usuario
    }
    
    AUDIT_LOG {
        int id PK
        string usuario
        string accion
        string tabla
        string registro_id
        text detalles
        timestamp fecha
    }
    
    TRAILERS {
        int id PK
        string trailer
        string billToCo
        string status
    }
    
    WORK_ORDERS ||--o{ WORK_ORDER_PARTS : "has"
    INVENTORY ||--o{ RECEIVES : "received"
    INVENTORY ||--o{ WORK_ORDER_PARTS : "uses"
    RECEIVES ||--o{ WORK_ORDER_PARTS : "tracks"
```

## 🔄 FLUJO COMPLETO SISTEMA

```mermaid
flowchart TD
    subgraph "👤 USUARIO"
        U1[Login] --> U2[Navegación]
        U2 --> U3[Crear/Editar WO]
        U3 --> U4[Ver PDF]
    end
    
    subgraph "🌐 FRONTEND React"
        F1[Componentes UI] --> F2[Formularios]
        F2 --> F3[Validación]
        F3 --> F4[API Calls]
    end
    
    subgraph "🔧 BACKEND Express"
        B1[Rutas API] --> B2[Validación Datos]
        B2 --> B3[Lógica Negocio]
        B3 --> B4[Base de Datos]
        B4 --> B5[FIFO Processing]
        B5 --> B6[PDF Generation]
    end
    
    subgraph "🗄️ PERSISTENCIA"
        D1[MySQL Database] --> D2[Tablas Normalizadas]
        D2 --> D3[Audit Log]
        D3 --> D4[File Storage]
    end
    
    subgraph "☁️ DEPLOYMENT"
        C1[GitHub] --> C2[Render.com]
        C2 --> C3[Auto Deploy]
        C3 --> C4[Health Check]
    end
    
    U1 --> F1
    F4 --> B1
    B6 --> D1
    D4 --> F1
    C1 --> C2
    B1 --> C2
```

## ⚡ OPTIMIZACIONES MEMORIA

```mermaid
flowchart TD
    MemStart([⚠️ Problema Memoria 512MB]) --> Opt1[🔧 Node.js Flags]
    Opt1 --> Opt2[📄 PDF Buffer Cleanup]
    Opt2 --> Opt3[⏱️ setImmediate vs setTimeout]
    Opt3 --> Opt4[🔄 Keep-alive Deshabilitado]
    Opt4 --> Opt5[🗑️ Garbage Collection]
    Opt5 --> Result[✅ Memoria Optimizada]
    
    subgraph "🔧 OPTIMIZACIONES APLICADAS"
        NodeFlags[--max-old-space-size=400<br/>--optimize-for-size]
        BufferClean[chunks.length = 0<br/>after PDF generation]
        SetImm[setImmediate()<br/>mejor gestión memoria]
        NoKeepAlive[Keep-alive OFF<br/>reduce requests]
        GC[global.gc()<br/>si disponible]
    end
```

## 📊 MÉTRICAS Y MONITOREO

```mermaid
flowchart LR
    subgraph "📈 MÉTRICAS"
        M1[Work Orders Creadas]
        M2[PDFs Generados]
        M3[Partes Procesadas FIFO]
        M4[Memoria Utilizada]
        M5[Tiempo Respuesta]
    end
    
    subgraph "🔍 LOGS"
        L1[Console Logs]
        L2[Audit Log BD]
        L3[Render Logs]
        L4[Error Tracking]
    end
    
    subgraph "⚠️ ALERTAS"
        A1[Memory Usage > 400MB]
        A2[PDF Generation Fails]
        A3[Database Connection Lost]
        A4[FIFO Processing Error]
    end
```

---

## 🎯 RESUMEN FLUJOS PRINCIPALES

1. **🔐 Autenticación** → Login → Verificación → Acceso al sistema
2. **📝 Crear WO** → Formulario → Autocompletado → Validación → BD → FIFO → PDF
3. **🔧 Sistema FIFO** → Buscar stock → Descontar → Registrar → Vincular invoices
4. **📄 PDF Generation** → Datos → Diseño profesional → Guardar → Cleanup memoria
5. **💾 Persistencia** → MySQL normalizado → Audit log → File storage
6. **☁️ Deployment** → GitHub → Render → Auto-deploy → Health checks

**🚀 El sistema está completamente integrado con optimizaciones de memoria y flujos automatizados!**
