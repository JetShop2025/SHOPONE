# Manual de Usuario - SHOPONE
## Sistema de Gestión de Órdenes de Trabajo

**Versión:** 2.0  
**Última Actualización:** Enero 2025  
**Tipo de Sistema:** Gestión de Órdenes de Trabajo e Inventario

---

## Índice

1. [Resumen del Sistema](#resumen-del-sistema)
2. [Primeros Pasos](#primeros-pasos)
3. [Navegación del Menú Principal](#navegación-del-menú-principal)
4. [Módulo de Órdenes de Trabajo](#módulo-de-órdenes-de-trabajo)
5. [Gestión de Inventario](#gestión-de-inventario)
6. [Control de Trailers](#control-de-trailers)
7. [Ubicación de Trailers](#ubicación-de-trailers)
8. [Sistema de Auditoría](#sistema-de-auditoría)
9. [Generación de PDFs](#generación-de-pdfs)
10. [Solución de Problemas](#solución-de-problemas)
11. [Mejores Prácticas](#mejores-prácticas)

---

## Resumen del Sistema

El Sistema Gráfico v2 es una plataforma integral de gestión de órdenes de trabajo diseñada para operaciones de mantenimiento de flotillas. Integra la creación de órdenes de trabajo, seguimiento de inventario, gestión de trailers y registro de auditoría en un sistema unificado.

### Características Principales
- **Gestión de Órdenes de Trabajo**: Ciclo completo desde creación hasta finalización
- **Inventario en Tiempo Real**: Deducción de inventario basada en FIFO con seguimiento en vivo
- **Control de Trailers**: Gestión de flotilla con capacidades de renta/devolución
- **Generación de PDFs**: Documentación automática de órdenes de trabajo
- **Soporte Multi-mecánico**: Seguimiento de múltiples mecánicos por orden de trabajo
- **Rastro de Auditoría**: Registro completo de actividades del sistema
- **Responsive Móvil**: Funciona en escritorio, tablet y dispositivos móviles

### Arquitectura del Sistema
- **Frontend**: React 19 con TypeScript
- **Backend**: API Node.js/Express
- **Base de Datos**: MySQL con consultas optimizadas
- **Almacenamiento de Archivos**: Generación de PDFs y gestión de documentos

---

## Primeros Pasos

### Acceso al Sistema
1. Abra su navegador web
2. Navegue a la URL del sistema (proporcionada por su administrador)
3. No se requiere inicio de sesión para la mayoría de funciones (sistema de acceso abierto)
4. El módulo de auditoría requiere protección por contraseña

### Requisitos del Navegador
- **Recomendado**: Google Chrome, Firefox, Safari, Edge
- **Mínimo**: Cualquier navegador moderno con JavaScript habilitado
- **Móvil**: iOS Safari, Android Chrome

---

## Navegación del Menú Principal

El menú principal proporciona acceso a todos los módulos del sistema:

### Módulos Disponibles
1. **INVENTARIO** (Azul) - Gestionar partes y stock
2. **ÓRDENES DE TRABAJO** (Verde) - Crear y rastrear órdenes de trabajo
3. **CONTROL DE TRAILERS** (Azul) - Gestionar flotilla de trailers
4. **UBICACIÓN DE TRAILERS** (Naranja) - Seguimiento GPS y ubicaciones
5. **AUDITORÍA** (Rojo) - Registros de actividad del sistema (protegido por contraseña)

### Consejos de Navegación
- Haga clic en cualquier botón de módulo para ingresar a esa sección
- Use el botón atrás del navegador para regresar al menú principal
- Cada módulo tiene su propia navegación y controles

---

## Módulo de Órdenes de Trabajo

El módulo de Órdenes de Trabajo es el núcleo del sistema, manejando todo el seguimiento del trabajo de mantenimiento.

### Creando una Nueva Orden de Trabajo

1. **Haga clic en el botón "Nueva Orden de Trabajo"**
2. **Complete la información básica:**
   - **Facturar a Compañía**: Seleccione del dropdown (GALGRE, JETGRE, PRIGRE, etc.)
   - **Trailer**: Auto-completado basado en la selección de Facturar a Compañía
   - **Fecha**: Fecha actual (puede ser modificada)
   - **Mecánico**: Ingrese nombre del mecánico
   - **Descripción**: Descripción detallada del trabajo

3. **Agregar Partes (si es necesario):**
   - Haga clic en el botón "Agregar Parte"
   - Ingrese SKU (auto-completado disponible)
   - El sistema auto-completará los detalles de la parte desde el inventario
   - Especifique la cantidad utilizada
   - El costo se completa automáticamente

4. **Opciones Avanzadas:**
   - **Múltiples Mecánicos**: Agregar mecánicos adicionales con horas individuales
   - **Opciones Extras**: Servicios adicionales o notas
   - **Partes Pendientes**: Agregar partes en espera de entrega para trailers específicos

5. **Establecer Estado:**
   - **PROCESSING**: Trabajo en progreso
   - **APPROVED**: Trabajo completado, esperando aprobación final
   - **FINISHED**: Trabajo completamente terminado

6. **Guardar**: Haga clic en "Guardar" para crear la orden de trabajo

### Editando Órdenes de Trabajo

1. **Seleccionar Orden de Trabajo**: Haga clic en cualquier fila en la tabla de órdenes de trabajo
2. **Haga clic en el botón "Editar"**
3. **Modificar campos** según sea necesario
4. **Campo ID Classic**: Aparece solo en modo de edición para seguimiento
5. **Guardar cambios**: El sistema actualizará el inventario y regenerará el PDF

### Características de Órdenes de Trabajo

#### Filtrado y Búsqueda
- **Rango de Fechas**: Filtrar por rangos de fechas específicos
- **Filtro de Semana**: Ver órdenes de trabajo por semana
- **Filtro de Estado**: Filtrar por PROCESSING, APPROVED, FINISHED
- **Búsqueda ID Classic**: Búsqueda rápida por número ID Classic

#### Operaciones en Lote
- **Seleccionar Múltiples**: Use casillas de verificación para seleccionar múltiples órdenes de trabajo
- **Eliminar en Lote**: Eliminar múltiples órdenes de trabajo a la vez
- **Exportar**: Exportar resultados filtrados a Excel

#### Características Inteligentes
- **Auto-completado**: Las partes se auto-completan desde el inventario
- **Integración de Partes Pendientes**: Muestra partes en espera para trailers específicos
- **Deducción de Inventario**: Reducción automática de inventario FIFO
- **Generación de PDF**: Creación automática de PDF con enlaces de facturas

### Seguimiento de Horas de Mecánicos

#### Modo de Mecánico Único
- Ingrese nombre del mecánico y horas totales
- El sistema calcula el costo laboral a $60/hora

#### Modo de Múltiples Mecánicos
- Agregar múltiples mecánicos con horas individuales
- Seguimiento de horas regulares y horas muertas por separado
- El sistema totaliza todas las horas para el cálculo laboral

#### Modal de Horómetro
- Haga clic en el botón "Horómetro" para ver estadísticas detalladas de mecánicos
- Filtrar por semana para ver datos de períodos específicos
- Muestra horas totales, órdenes de trabajo y horas muertas por mecánico

### Sistema de Partes Pendientes

#### ¿Qué son las Partes Pendientes?
Partes que han sido recibidas y asignadas a trailers específicos pero aún no se han usado en órdenes de trabajo.

#### Usando Partes Pendientes
1. **Ver Partes Disponibles**: Al crear una orden de trabajo, el sistema muestra partes pendientes para el trailer seleccionado
2. **Agregar a Orden de Trabajo**: Haga clic en el botón "Agregar a WO" junto a las partes deseadas
3. **Procesamiento Automático**: Las partes se mueven automáticamente del estado pendiente al usado
4. **Actualización de Inventario**: El sistema actualiza los conteos de inventario automáticamente

### Flujo de Estados

```
PROCESSING → APPROVED → FINISHED
```

- **PROCESSING**: Estado predeterminado para nuevas órdenes de trabajo
- **APPROVED**: Trabajo completado, listo para aprobación final
- **FINISHED**: Todo el trabajo completo, orden de trabajo cerrada

---

## Gestión de Inventario

### Resumen del Inventario
El módulo de inventario gestiona todas las partes, niveles de stock y recepciones.

### Tabla Principal de Inventario

#### Columnas Mostradas
- **SKU**: Número de parte (identificador único)
- **CÓDIGO DE BARRAS**: Código de barras para escaneo
- **CATEGORÍA**: Categoría/tipo de parte
- **NOMBRE DE PARTE**: Nombre descriptivo
- **PROVEEDOR**: Información del proveedor
- **MARCA**: Marca del fabricante
- **U/M**: Unidad de medida
- **ÁREA**: Ubicación de almacenamiento
- **RECIBIDO**: Cantidad total recibida
- **SALIDAS WO**: Cantidad usada en órdenes de trabajo
- **EN MANO**: Stock disponible actual
- **ENLACE IMAGEN**: URL de imagen del producto
- **PRECIO (USD)**: Costo unitario
- **ENLACE FACTURA**: Enlace a factura de compra

### Agregando Nuevos Elementos de Inventario

1. **Haga clic en el botón "Agregar Parte"**
2. **Complete los campos requeridos:**
   - SKU (requerido)
   - Nombre de Parte (requerido)
   - Categoría, Proveedor, Marca
   - Unidad de Medida
   - Área/Ubicación
   - Precio
   - Enlaces de imagen y factura

3. **Establecer Stock Inicial**: Ingrese cantidad recibida
4. **Guardar**: El sistema crea nuevo elemento de inventario

### Editando Inventario

1. **Seleccionar Elemento**: Haga clic en la fila del inventario
2. **Haga clic en el botón "Editar"**
3. **Modificar campos** según sea necesario
4. **Guardar cambios**: Actualiza el registro de inventario

### Módulo de Recepción de Inventario

#### Propósito
Rastrear partes entrantes y asignarlas a trailers específicos o stock general.

#### Proceso de Recepción
1. **Acceso**: Haga clic en el botón "Recibir Inventario"
2. **Complete el Formulario de Recepción:**
   - **SKU**: Ingrese número de parte
   - **Descripción del Elemento**: Detalles de la parte
   - **Categoría**: Tipo de parte
   - **Proveedor/Marca**: Información del proveedor
   - **Trailer de Destino**: Trailer específico (opcional)
   - **Cantidad**: Cantidad recibida
   - **Costo**: Costo total incluyendo impuestos
   - **Info de Factura**: Número de factura y enlace
   - **PO Classic**: Referencia de orden de compra

3. **Guardar**: Crea registro de recepción y actualiza inventario

#### Gestión de Partes Pendientes
- Las partes con trailers de destino se convierten en "partes pendientes"
- Se muestran en la creación de órdenes de trabajo para trailers específicos
- Se usan automáticamente cuando se crean órdenes de trabajo
- El estado cambia de PENDING a USED

---

## Control de Trailers

### Gestión de Flotilla de Trailers
Sistema integral de seguimiento y gestión de trailers.

### Visualización de Información de Trailers

#### Las Tarjetas de Trailers Muestran:
- **Número de Trailer**: Identificador único
- **Estado**: DISPONIBLE o RENTADO
- **Asignación de Cliente**: Arrendatario actual (si aplica)
- **Tipo/Modelo**: Especificaciones del trailer
- **Ubicación**: Ubicación actual
- **Fechas de Renta**: Fechas de inicio y fin

### Organización de Trailers Basada en Clientes

#### Clientes de Renta
- AMAZON, WALMART, HOME DEPOT, FEDEX, UPS, TARGET
- Usados para operaciones de renta externa

#### Clientes Regulares (Clientes de Órdenes de Trabajo)
- GALGRE, JETGRE, PRIGRE, RAN100, GABGRE
- Usados para asignaciones de órdenes de trabajo

#### Rangos de Números de Trailers
- **GALGRE**: 1-199
- **JETGRE**: 2-200-299
- **PRIGRE**: 3-300-399
- **RAN100**: 4-400-499
- **GABGRE**: 5-500-599

### Operaciones de Trailers

#### Rentando un Trailer
1. **Seleccionar Trailer Disponible**: Haga clic en trailer con estado DISPONIBLE
2. **Haga clic en el botón "Rentar"**
3. **Complete el Formulario de Renta:**
   - **Cliente**: Seleccione de la lista de clientes de renta
   - **Fecha de Renta**: Fecha de inicio
   - **Fecha de Devolución**: Devolución esperada
   - **Notas**: Información adicional
4. **Confirmar**: El estado del trailer cambia a RENTADO

#### Devolviendo un Trailer
1. **Seleccionar Trailer Rentado**: Haga clic en trailer con estado RENTADO
2. **Haga clic en el botón "Devolver"**
3. **Confirmar Devolución**: El sistema registra la fecha de devolución
4. **Actualización de Estado**: El trailer se vuelve DISPONIBLE nuevamente

#### Viendo Historial de Rentas
1. **Haga clic en el botón "Historial"** en cualquier trailer
2. **Ver Registro Completo**: Todos los períodos de renta y clientes
3. **Filtrar por Fecha**: Ver períodos específicos de tiempo

#### Viendo Órdenes de Trabajo
1. **Haga clic en el botón "W.O"** en cualquier trailer
2. **Ver Todas las Órdenes de Trabajo**: Historial completo de mantenimiento
3. **Filtrar por Mes**: Ver períodos específicos
4. **Acceder PDFs**: Enlaces directos a documentos de órdenes de trabajo

---

## Ubicación de Trailers

### Sistema de Seguimiento GPS
Seguimiento y gestión de ubicación de trailers en tiempo real.

### Características
- **Coordenadas GPS en Vivo**: Posiciones actuales de trailers
- **Historial de Ubicaciones**: Rastrear movimiento a lo largo del tiempo
- **Geocercas**: Establecer límites de ubicación
- **Optimización de Rutas**: Planear rutas eficientes
- **Integración Móvil**: Actualizar ubicaciones desde dispositivos móviles

### Usando el Módulo de Ubicación
1. **Acceder al Módulo**: Haga clic en "UBICACIÓN DE TRAILERS" desde el menú principal
2. **Ver Mapa**: Ver todas las posiciones de trailers
3. **Seleccionar Trailer**: Haga clic en marcador para detalles
4. **Actualizar Ubicación**: Actualizaciones manuales de ubicación si es necesario
5. **Generar Reportes**: Reportes basados en ubicación

---

## Sistema de Auditoría

### Seguridad y Acceso
- **Protegido por Contraseña**: Requiere contraseña "6214"
- **Acceso Administrativo**: Solo para personal autorizado
- **Registro de Actividad Completo**: Todos los cambios del sistema son rastreados

### Características del Registro de Auditoría

#### Información Rastreada
- **Acciones de Usuario**: Quién realizó cada operación
- **Marcas de Tiempo**: Fecha y hora exactas
- **Módulo**: Qué área del sistema fue afectada
- **Tipo de Operación**: Operaciones CREATE, UPDATE, DELETE
- **Cambios de Datos**: Valores antes y después
- **Detalles de Órdenes de Trabajo**: Ciclo completo de vida de órdenes de trabajo
- **Cambios de Inventario**: Movimientos y ajustes de stock
- **Operaciones de Trailers**: Actividades de renta y devolución

#### Viendo Registros de Auditoría
1. **Acceder a Auditoría**: Haga clic en "AUDITORÍA" desde el menú principal
2. **Ingresar Contraseña**: "6214"
3. **Navegar Registros**: Ver actividad cronológica
4. **Opciones de Filtro**: Filtrar por fecha, usuario o módulo
5. **Exportar Datos**: Generar reportes de auditoría

### Categorías de Auditoría

#### Auditorías de Órdenes de Trabajo
- Creación de órdenes de trabajo con todos los detalles
- Ediciones y modificaciones
- Cambios de estado
- Registros de eliminación
- Adiciones y remociones de partes

#### Auditorías de Inventario
- Adiciones de nuevas partes
- Ajustes de stock
- Registros de recepción
- Deducciones de inventario
- Cambios de precios

#### Auditorías de Trailers
- Transacciones de renta
- Registros de devolución
- Cambios de estado
- Actualizaciones de ubicación

---

## Generación de PDFs

### Creación Automática de PDFs
El sistema genera automáticamente PDFs profesionales para todas las órdenes de trabajo.

### Características de PDFs

#### Contenidos del Documento
- **Encabezado**: Marca de la empresa y número de orden de trabajo
- **Detalles de Orden de Trabajo**: 
  - Facturar a Compañía
  - Número de trailer
  - Fecha y mecánico
  - Número ID Classic
  - Estado
- **Descripción**: Descripción completa del trabajo
- **Lista de Partes**: 
  - SKU y nombres de partes
  - Cantidades usadas
  - Costos unitarios y totales
  - Enlaces de facturas para trazabilidad
- **Resumen Laboral**:
  - Horas de mecánico
  - Costos laborales ($60/hora)
  - Costo total de orden de trabajo
- **Formato Profesional**: Diseño limpio, listo para imprimir

#### Acceso a PDFs
- **Generación Automática**: Creado cuando se guarda la orden de trabajo
- **Múltiples Puntos de Acceso**:
  - Botón "Ver PDF" en tabla de órdenes de trabajo
  - Enlaces directos en historial de órdenes de trabajo de trailers
  - Capacidades de distribución por email
- **Regeneración**: Los PDFs se actualizan automáticamente cuando se editan órdenes de trabajo

#### Integración de Facturas
- **Enlaces Clicables**: Enlaces directos a facturas de partes
- **Trazabilidad**: Documentación completa de fuentes de partes
- **Verificación de Costos**: Acceso fácil a documentación de compras

---

## Solución de Problemas

### Problemas Comunes y Soluciones

#### Problemas de Conexión al Servidor
**Problema**: Errores de "Servidor fuera de línea" o conexión
**Soluciones**:
1. Verificar conexión a internet
2. Esperar a que el servidor despierte (puede tomar 30-60 segundos)
3. Refrescar la página
4. Limpiar caché del navegador si los problemas persisten

#### Orden de Trabajo No Se Guarda
**Problema**: Falla la creación de orden de trabajo
**Soluciones**:
1. Verificar que todos los campos requeridos estén completados
2. Verificar que el número de trailer sea válido para la Compañía seleccionada
3. Asegurar que las partes tengan SKUs válidos
4. Intentar nuevamente después de unos segundos

#### Inventario No Carga
**Problema**: Las partes no aparecen en el dropdown
**Soluciones**:
1. Esperar a que el inventario cargue (puede tomar unos segundos)
2. Refrescar la página
3. Verificar estado de conexión del servidor

#### PDF No Se Genera
**Problema**: El botón ver PDF no funciona
**Soluciones**:
1. Permitir ventanas emergentes en configuración del navegador
2. Verificar si la orden de trabajo se guardó exitosamente
3. Intentar regenerar PDF editando y guardando la orden de trabajo

#### Auto-completado No Funciona
**Problema**: Los detalles de partes no se auto-completan
**Soluciones**:
1. Asegurar que el SKU existe en el inventario
2. Esperar a que los datos del inventario carguen
3. Escribir el número SKU completo
4. Verificar errores tipográficos en entrada de SKU

### Problemas Específicos del Navegador

#### Chrome
- Habilitar ventanas emergentes para ver PDFs
- Limpiar caché si ocurren problemas de rendimiento

#### Firefox
- Permitir ventanas emergentes y descargas
- Verificar configuraciones de privacidad

#### Safari
- Habilitar JavaScript
- Permitir ventanas emergentes para funcionalidad de PDF

#### Navegadores Móviles
- Usar modo horizontal para mejor visibilidad
- Tocar y mantener para menús contextuales
- Habilitar ventanas emergentes para ver PDFs

---

## Mejores Prácticas

### Gestión de Órdenes de Trabajo

#### Creando Órdenes de Trabajo Efectivas
1. **Usar Descripciones Claras**: Escribir descripciones de trabajo detalladas y específicas
2. **Selección Precisa de Partes**: Verificar SKUs antes de agregar partes
3. **Actualizaciones Apropiadas de Estado**: Mantener el estado actual durante el ciclo de vida del trabajo
4. **Completar Todos los Campos**: Llenar toda la información relevante
5. **Revisar Antes de Guardar**: Verificar todas las entradas

#### Mejores Prácticas de Inventario
1. **Verificaciones Regulares de Stock**: Monitorear cantidades EN MANO
2. **Recepciones Precisas**: Ingresar datos de recepción pronta y precisamente
3. **Gestión Apropiada de SKUs**: Usar convenciones de nomenclatura consistentes
4. **Actualizar Costos**: Mantener costos de partes actuales
5. **Enlaces de Facturas**: Siempre incluir enlaces de facturas para trazabilidad

#### Gestión de Trailers
1. **Actualizaciones Oportunas**: Actualizar estado de trailer inmediatamente al rentar/devolver
2. **Información Precisa**: Asegurar que la información de cliente y fecha sea correcta
3. **Monitoreo Regular**: Verificar estado de trailers regularmente
4. **Programación de Mantenimiento**: Usar historial de órdenes de trabajo para planear mantenimiento

### Rendimiento del Sistema

#### Consejos de Uso Óptimo
1. **Refrescar Regularmente**: Refrescar páginas periódicamente para datos más recientes
2. **Evitar Múltiples Pestañas**: Usar una sola pestaña para prevenir conflictos
3. **Guardar Frecuentemente**: Guardar órdenes de trabajo prontamente para evitar pérdida de datos
4. **Limpiar Caché del Navegador**: Limpiar caché mensualmente para mejor rendimiento

#### Gestión de Datos
1. **Nomenclatura Consistente**: Usar convenciones de nomenclatura estandarizadas
2. **Respaldos Regulares**: El sistema realiza respaldos automáticos
3. **Validación de Datos**: Verificar precisión de datos antes de guardar
4. **Archivar Registros Antiguos**: Mantener rendimiento óptimo del sistema

### Pautas de Seguridad
1. **Acceso a Auditoría**: Proteger contraseña de auditoría ("6214")
2. **Monitoreo Regular**: Revisar registros de auditoría periódicamente
3. **Privacidad de Datos**: Proteger información sensible de clientes y financiera
4. **Control de Acceso**: Limitar acceso al sistema solo a personal autorizado

---

## Soporte y Mantenimiento

### Actualizaciones del Sistema
- **Actualizaciones Automáticas**: Las actualizaciones del sistema se despliegan automáticamente
- **Anuncios de Características**: Nuevas características anunciadas vía notificaciones del sistema
- **Ventanas de Mantenimiento**: Mantenimiento programado comunicado con anticipación

### Obteniendo Ayuda
1. **Documentación**: Referirse a este manual primero
2. **Administrador del Sistema**: Contactar a su administrador del sistema
3. **Soporte Técnico**: Contactar al equipo de desarrollo para problemas técnicos
4. **Entrenamiento**: Entrenamiento adicional disponible bajo solicitud

### Monitoreo del Sistema
- **Seguimiento de Rendimiento**: El sistema monitorea su propio rendimiento
- **Registro de Errores**: Detección automática de errores y reportes
- **Analíticas de Uso**: El sistema rastrea patrones de uso para optimización

---

## Apéndices

### Apéndice A: Atajos de Teclado
- **Ctrl+N**: Nueva orden de trabajo (cuando esté en módulo de órdenes de trabajo)
- **Ctrl+S**: Guardar formulario actual
- **Ctrl+F**: Buscar/Filtrar
- **Esc**: Cerrar diálogos modales

### Apéndice B: Límites del Sistema
- **Órdenes de Trabajo**: Sin límite
- **Elementos de Inventario**: Sin límite práctico
- **Almacenamiento de PDFs**: Almacenamiento automático en la nube
- **Sesiones de Usuario**: Tiempo de espera de 8 horas

### Apéndice C: Puntos de Integración
- **Exportación Excel**: Compatible con Excel 2016+
- **Visualizadores PDF**: Compatible con todos los visualizadores PDF estándar
- **Aplicaciones Móviles**: Diseño web responsive funciona con todos los navegadores móviles
- **Impresión**: Optimizado para papel estándar 8.5x11"

---

*Este manual cubre el Sistema Gráfico v2. Para ayuda adicional o entrenamiento, contacte a su administrador del sistema.*

**Versión del Documento**: 1.0  
**Última Actualización**: Enero 2025  
**Tipo de Manual**: Guía del Usuario Final
   - **AUDIT LOG** (Botón morado)

### Elementos de la Interfaz de Usuario
- **Indicador de Estado del Servidor**: Ubicado en la esquina superior derecha de la mayoría de pantallas
  - 🟢 **Online**: Sistema conectado y funcionando normalmente
  - 🟡 **Waking up**: Servidor iniciándose (puede tomar 30-60 segundos)
  - 🔴 **Offline**: Conexión perdida, use el botón "Reconnect"

---

## Módulo de Órdenes de Trabajo

### Resumen
El módulo de Órdenes de Trabajo es el núcleo del sistema, permitiendo crear, editar y rastrear órdenes de trabajo de mantenimiento para trailers y equipos.

### Creando una Nueva Orden de Trabajo

1. **Acceso**: Haga clic en "WORK ORDERS" desde el menú principal
2. **Nueva Orden de Trabajo**: Haga clic en el botón azul "New Work Order"
3. **Completar Información Requerida**:
   - **Bill To Co**: Seleccionar del dropdown (GALGRE, JETGRE, PRIGRE, etc.)
   - **Trailer**: Seleccionar número de trailer (auto-poblado basado en Bill To Co)
   - **Date**: Seleccionar fecha de trabajo
   - **Mechanic**: Ingresar nombre del mecánico o seleccionar opción multi-mecánico
   - **Description**: Descripción detallada del trabajo realizado
   - **Status**: PROCESSING (por defecto) → APPROVED → FINISHED

### Estados de Órdenes de Trabajo
- **PROCESSING**: Orden de trabajo creada, trabajo en progreso
- **APPROVED**: Trabajo completado y aprobado por supervisor
- **FINISHED**: Orden de trabajo completada y facturada (requiere ID Classic)

### Agregando Partes a Órdenes de Trabajo

#### Entrada Manual de Partes
1. **Campo SKU**: Ingresar número SKU de la parte
2. **Auto-completado**: Sistema automáticamente completa nombre y costo de la parte desde inventario
3. **Cantidad**: Ingresar cantidad usada
4. **Costo**: Auto-poblado desde inventario (puede ajustarse manualmente)

#### Integración de Partes Pendientes
- **Vista Previa de Partes Pendientes**: Si el trailer tiene partes pendientes, aparecen en caja verde
- **Agregar Parte Pendiente**: Hacer clic en botón "Add Part" junto a la parte pendiente
- **Procesamiento Automático**: Sistema usa método FIFO para rastrear uso de partes

### Soporte Multi-mecánico
1. **Mecánico Único**: Ingresar nombre en campo "Mechanic"
2. **Múltiples Mecánicos**: Usar opción "Add Mechanic"
   - Ingresar nombre del mecánico y horas trabajadas
   - Sistema automáticamente calcula horas totales
   - Costo de labor calculado a $60/hora

### Opciones Extras
- **5% Markup**: Agrega 5% al costo total
- **15% Shop**: Agrega 15% de margen de taller
- **15% Weld**: Agrega 15% de margen de soldadura

### Editando Órdenes de Trabajo
1. **Seleccionar Orden de Trabajo**: Hacer clic en fila de tabla para seleccionar
2. **Botón Edit**: Hacer clic en botón "Edit" (requiere contraseña: 6214)
3. **Cargar Orden de Trabajo**: Ingresar ID de orden de trabajo y contraseña
4. **Hacer Cambios**: Modificar cualquier campo según sea necesario
5. **Guardar**: Los cambios son auditados automáticamente

### Filtrado y Búsqueda
- **Filtrar por Semana**: Seleccionar semana específica
- **Filtrar por Día**: Seleccionar fecha específica
- **Filtrar por Estado**: PROCESSING, APPROVED, FINISHED
- **Filtrar por ID Classic**: Buscar por número de ID clásico

### Generación de PDF
- **Automático**: PDF generado cuando se crea/edita orden de trabajo
- **Manual**: Hacer clic en botón "View PDF" para órdenes de trabajo existentes
- **Enlaces de Factura**: Sistema automáticamente abre enlaces de facturas relacionadas

---

## Gestión de Inventario

### Resumen
El módulo de Inventario gestiona partes, recibos y niveles de stock con seguimiento en tiempo real y deducción FIFO.

### Accediendo al Inventario
1. **Desde Menú Principal**: Hacer clic en "INVENTORY"
2. **Elegir Módulo**:
   - **MASTER**: Gestionar artículos de inventario y niveles de stock
   - **RECEIVE**: Gestionar recibos entrantes y partes pendientes

### Inventario Master

#### Visualizando Inventario
- **Datos en Tiempo Real**: Se actualiza cada 2 minutos
- **Columnas Disponibles**:
  - SKU, Bar Code, Category, Part Name
  - Provider, Brand, Unit of Measure (U/M)
  - Area, Received, WO Outputs, On Hand
  - Image Link, Price (USD), Invoice Link

#### Agregando Nuevas Partes
1. **Botón New Part**: Hacer clic para abrir formulario
2. **Campos Requeridos**:
   - **SKU**: Identificador único de la parte
   - **Part Name**: Descripción de la parte
   - **Category**: Categoría de la parte
   - **Provider**: Nombre del proveedor
   - **On Hand**: Cantidad inicial
   - **Price**: Costo unitario en USD
3. **Auto-generado**: Código de barras creado automáticamente como "BC-{SKU}"
4. **Contraseña Requerida**: 6214

#### Editando Partes
1. **Seleccionar Parte**: Hacer clic en fila de inventario
2. **Botón Edit**: Requiere contraseña (6214)
3. **Modificar Campos**: Actualizar cualquier información
4. **Guardar**: Los cambios son auditados

#### Eliminando Partes
1. **Seleccionar Parte**: Hacer clic en fila de inventario
2. **Botón Delete**: Requiere contraseña (6214)
3. **Confirmación**: Confirmar eliminación
4. **Registro de Auditoría**: La eliminación es registrada

### Recibir Inventario

#### Agregando Recibos
1. **Nuevo Recibo**: Hacer clic en botón "New Receipt"
2. **Información Requerida**:
   - **SKU**: Identificador de la parte
   - **Category**: Categoría de la parte
   - **Item**: Descripción de la parte
   - **Provider**: Proveedor
   - **Brand**: Fabricante
   - **U/M**: Unidad de medida
   - **Bill To Co**: Cliente/empresa
   - **Destination Trailer**: Trailer destino (si aplica)
   - **Invoice**: Número de factura
   - **Invoice Link**: Enlace de OneDrive o web a la factura
   - **Quantity**: Cantidad recibida
   - **Cost + Tax**: Costo total incluyendo impuestos

#### Gestión de Estado de Recibos
- **PENDING**: Partes recibidas pero aún no usadas
- **USED**: Partes consumidas en órdenes de trabajo
- **Procesamiento FIFO**: Deducción automática Primero en Entrar, Primero en Salir

#### Editando Recibos
1. **Seleccionar Recibo**: Hacer clic en fila de tabla
2. **Botón Edit**: Abre formulario de edición
3. **Actualizar Información**: Modificar según sea necesario
4. **Guardar**: Los cambios son rastreados

---

## Control de Trailers

### Resumen
Gestiona el estado de la flota de trailers, operaciones de renta e historial de órdenes de trabajo.

### Características de Gestión de Trailers

#### Estado de Trailers
- **DISPONIBLE**: Disponible para renta
- **RENTADO**: Actualmente rentado
- **MANTENIMIENTO**: Bajo mantenimiento

#### Operaciones de Renta
1. **Rentar Trailer**: 
   - Hacer clic en "📋 Rentar" en trailer disponible
   - Seleccionar cliente del dropdown
   - Confirmar fechas de renta
   - Estado cambia a RENTADO

2. **Devolver Trailer**:
   - Hacer clic en "↩️ Devolver" en trailer rentado
   - Confirmar devolución
   - Estado cambia a DISPONIBLE

#### Gestión de Clientes
- **Clientes de Renta**: AMAZON, WALMART, HOME DEPOT, FEDEX, UPS, TARGET
- **Clientes Regulares**: GALGRE, JETGRE, PRIGRE, RAN100, GABGRE
- **Filtrado de Clientes**: Filtrar trailers por cliente específico

#### Historial de Trailers
1. **Historial de Renta**: Hacer clic en "📊 Historial"
   - Ver períodos de renta
   - Información de cliente
   - Fechas y duración

2. **Historial de Órdenes de Trabajo**: Hacer clic en "🔧 W.O"
   - Ver todas las órdenes de trabajo del trailer
   - Filtrar por mes/año
   - Generar PDFs para órdenes de trabajo

### Rangos de Números de Trailers
- **GALGRE**: 1-100 a 1-199 (incluyendo unidades TRK especiales)
- **JETGRE**: 2-001 a 2-016 (más 2-01 TRK)
- **PRIGRE**: 3-300 a 3-323
- **RAN100**: 4-400 a 4-419
- **GABGRE**: 5-500 a 5-529

---

## Ubicación de Trailers

### Resumen
Sistema avanzado de seguimiento y gestión de ubicación de trailers basado en GPS.

### Características de Seguimiento de Ubicación

#### Ubicación en Tiempo Real
- **Integración GPS**: Seguimiento de posición en tiempo real
- **Vista de Mapa**: Representación visual de ubicaciones de trailers
- **Actualizaciones de Estado**: Estado en vivo y actualizaciones de ubicación

#### Gestión de Activos
- **Selección de Activos**: Elegir de activos disponibles
- **Monitoreo de Estado**: Rastrear disponibilidad de activos
- **Historial de Ubicación**: Datos de posición históricos

#### Búsqueda y Filtro
- **Búsqueda de Activos**: Encontrar trailers específicos
- **Filtro de Estado**: Filtrar por estado de disponibilidad
- **Filtro de Ubicación**: Filtrar por área geográfica

---

## Registro de Auditoría

### Resumen
Registro completo de auditoría para todas las operaciones y cambios del sistema.

### Características de Auditoría

#### Seguimiento de Operaciones
- **Órdenes de Trabajo**: Creación, modificación, eliminación
- **Inventario**: Cambios de stock, adiciones de partes, deducciones
- **Trailers**: Operaciones de renta, cambios de estado
- **Recibos**: Procesamiento de recibos, actualizaciones de estado

#### Información de Auditoría
- **Usuario**: Quién realizó la acción
- **Acción**: Qué se hizo (CREATE, UPDATE, DELETE)
- **Tabla**: Qué módulo del sistema fue afectado
- **Detalles**: Cambios específicos realizados
- **Marca de Tiempo**: Cuándo ocurrió la acción

#### Opciones de Filtrado
- **Rango de Fechas**: Filtrar por período de tiempo específico
- **Usuario**: Filtrar por usuario específico
- **Tipo de Operación**: Filtrar por tipo de acción
- **Módulo**: Filtrar por módulo del sistema

---

## Generación de PDF

### Resumen
Generación automática de PDF para órdenes de trabajo con integración de facturas.

### Características de PDF

#### Generación Automática
- **Creación de Orden de Trabajo**: PDF generado automáticamente
- **Actualizaciones de Orden de Trabajo**: PDF regenerado en cambios
- **Cambios de Estado**: Nuevo PDF cuando cambia el estado

#### Contenido del PDF
- **Información de Encabezado**: Detalles de empresa, número de orden de trabajo
- **Detalles de Orden de Trabajo**: Trailer, fecha, mecánico, descripción
- **Lista de Partes**: SKU, descripción, cantidad, costo
- **Información de Labor**: Horas de mecánico y costos
- **Costos Totales**: Cálculos de partes, labor y margen
- **Enlaces de Factura**: Enlaces clicables a facturas de partes

#### Generación Manual de PDF
1. **Seleccionar Orden de Trabajo**: Hacer clic en fila de tabla
2. **Botón View PDF**: Hacer clic para generar PDF
3. **Enlaces de Factura**: Sistema automáticamente abre facturas relacionadas
4. **Opciones de Guardado**: PDF guardado en sistema y abierto en navegador

---

## Solución de Problemas

### Problemas Comunes

#### Conexión del Servidor
**Problema**: Servidor muestra "Offline" o "Waking up"
**Solución**: 
- Esperar 30-60 segundos para inicio del servidor
- Hacer clic en botón "Reconnect"
- Refrescar página del navegador si persisten problemas

#### Orden de Trabajo No Se Guarda
**Problema**: Formulario de orden de trabajo no se guarda
**Solución**:
- Verificar que todos los campos requeridos estén completados
- Verificar reglas de ID Classic (solo para estado FINISHED)
- Asegurar números únicos de ID Classic
- Verificar conexión a internet

#### Inventario No Carga
**Problema**: Tabla de inventario no muestra datos
**Solución**:
- Esperar refresco automático (intervalos de 2 minutos)
- Verificar indicador de estado del servidor
- Refrescar página del navegador
- Verificar conexión a base de datos

#### Generación de PDF Falla
**Problema**: PDF no se genera o abre
**Solución**:
- Verificar configuración de bloqueador de ventanas emergentes del navegador
- Asegurar que orden de trabajo tenga datos completos
- Verificar que enlaces de facturas sean accesibles
- Intentar generación manual de PDF

### Requisitos de Contraseña
- **Operaciones de Edición**: Contraseña 6214 requerida para:
  - Edición de órdenes de trabajo
  - Modificaciones de inventario
  - Eliminación de partes
  - Eliminación de órdenes de trabajo

### Compatibilidad de Navegador
- **Recomendado**: Chrome, Firefox, Edge (versiones más recientes)
- **Soporte Móvil**: Diseño responsivo para tablets
- **Internet Requerido**: Sistema requiere conexión estable a internet

### Respaldo de Datos
- **Automático**: Sistema automáticamente respalda datos
- **Registro de Auditoría**: Todos los cambios son registrados y preservados
- **Almacenamiento de PDF**: PDFs generados almacenados en base de datos del sistema

### Contacto de Soporte
Para soporte técnico o problemas del sistema:
- Verificar registro de auditoría para detalles de errores
- Anotar mensajes de error exactos
- Incluir pasos para reproducir problema
- Contactar administrador del sistema con detalles

---

## Mejores Prácticas

### Gestión de Órdenes de Trabajo
1. **Información Completa**: Siempre completar todos los campos requeridos
2. **Descripciones Precisas**: Proporcionar descripciones detalladas del trabajo
3. **Verificación de Partes**: Verificar números SKU antes de guardar
4. **Actualizaciones de Estado**: Mantener estado de orden de trabajo actualizado
5. **ID Classic**: Usar ID Classic único para órdenes FINISHED

### Gestión de Inventario
1. **Actualizaciones Regulares**: Mantener niveles de inventario actualizados
2. **Procesamiento de Recibos**: Procesar recibos prontamente
3. **Método FIFO**: Sistema automáticamente usa stock más antiguo primero
4. **Enlaces de Factura**: Siempre incluir enlaces de facturas para seguimiento

### Uso del Sistema
1. **Respaldos Regulares**: Sistema maneja respaldos automáticos
2. **Verificación de Datos**: Verificar entradas antes de guardar
3. **Revisión de Auditoría**: Revisar regularmente registros de auditoría
4. **Almacenamiento de PDF**: Mantener PDFs importantes guardados localmente
5. **Entrenamiento**: Asegurar que todos los usuarios entiendan características del sistema

---

*Este manual cubre la funcionalidad completa del Graphical System v2. Para soporte adicional o solicitudes de características, contacte a su administrador del sistema.*
