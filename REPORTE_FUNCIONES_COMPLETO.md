# Reporte Completo de Funciones

Fecha: 2026-03-12

## Cobertura y metodo
- Se inventariaron automaticamente 288 funciones/handlers en backend y frontend.
- Fuente de inventario completo: function_inventory_clean.txt.
- Verificacion de correccion: build frontend exitoso, revision de handlers/rutas, y lectura directa de modulos criticos.
- Estado de evaluacion:
	- Correcta: sin fallo directo visible en analisis estatico.
	- Riesgo: puede fallar en runtime, seguridad o mantenibilidad.
	- Incorrecta: fallo funcional confirmado en codigo.

## Resultado ejecutivo
- Correctas/aparentemente correctas: mayoria de funciones CRUD, utilidades de formato, y fetchers de datos.
- Riesgo medio/alto: funciones de autenticacion, rutas duplicadas en trailerLocation, varios hooks con dependencias faltantes.
- Incorrectas confirmadas: 3 puntos bloqueantes en backend/routes/workOrders.js.

## Hallazgos confirmados por funcion

### backend/routes/workOrders.js
- L9 | function registerPartFifo | Riesgo alto general por complejidad y volumen de log.
- L77 | registerPartFifo | Incorrecta: usa variable part no definida en insercion de work_order_parts (campo um).
- L105 | registerPartFifo | Incorrecta: repite variable part no definida en insercion fallback.
- L155 | function generateProfessionalPDF | Incorrecta: no utilizable por throw de prueba.
- L167 | generateProfessionalPDF | Incorrecta: throw de depuracion bloquea ejecucion real del PDF.
- L1009 | function logAccion | Correcta.
- L1021 | GET / | Correcta (lista work orders paginadas).
- L1093 | POST / | Riesgo medio: flujo grande, necesita pruebas de regresion por ramas complejas.
- L1428 | PUT /:id | Riesgo medio: muchas transformaciones de payload, requiere pruebas por casos borde.
- L1844 | POST /:id/generate-pdf | Riesgo medio si depende de generateProfessionalPDF actual.

### backend/server.js
- L247 | POST /api/login | Riesgo alto: compara password plano y genera token no firmado.
- L1212 | GET /api/ping | Correcta (ya funcional antes del catch-all).
- L1222 | GET /api/wake | Correcta (ya funcional antes del catch-all).

### backend/routes/trailers.js
- L42 | GET /:nombre/work-orders-historial | Correcta en calculos base, riesgo medio por parsing flexible de JSON/string.
- L121 | PUT /:nombre/estatus | Riesgo alto general.
- L129 | PUT /:nombre/estatus | Riesgo alto: password hardcodeada 6214.

### backend/routes/trailerLocation.js
- L499, L566, L625 | GET momentum (location/statistics/history) | Riesgo medio.
- L1051, L1089, L1123 | GET momentum (location/statistics/history) | Riesgo medio: endpoints duplicados con la misma firma.

### backend/routes/audit.js
- L6 | GET / | Correcta (usa placeholders para filtros de acciones).
- L72 | GET /audit-log | Correcta.
- L100 | GET /stats | Correcta.

### backend/routes/workOrderParts.js
- L8 | POST / | Correcta: usa db.deductInventoryFIFO existente en db.js.
- L53 | GET /:work_order_id | Correcta.

### src/utils/pdfGenerator.ts
- L38 | toSafeHttpUrl | Correcta.
- L60 | generateWorkOrderPDF | Correcta con mejoras aplicadas (links seguros y control de salto de pagina).
- L467 | savePDFToDatabase | Correcta.
- L490 | openInvoiceLinks | Correcta.
- L516 | openPDFInNewTab | Correcta.

### src/services
- src/services/authService.ts
	- authenticateUser | Riesgo medio por almacenamiento en localStorage (no httpOnly cookie).
	- logout, isAuthenticated | Correctas.
- src/services/workOrderService.ts
	- fetchWorkOrders, createWorkOrder, updateWorkOrder, deleteWorkOrder | Correctas.
- src/services/inventoryService.ts
	- fetchInventoryItems | Correcta.
- src/services/keepAlive.ts
	- start, stop, manualPing, ping | Correctas en comportamiento esperado; riesgo bajo por dependencia del endpoint /api/ping.

### Frontend componentes (resumen funcional)
- WorkOrdersTable, WorkOrderForm, FinishedWorkOrdersTable, TrailasTable, ReceiveInventory, InventoryTable:
	- Funciones de negocio principales: correctas en flujo general (alta/edicion/borrado/visualizacion PDF).
	- Riesgo medio: alto uso de any, warnings de hooks y no-unused-vars detectados por lint (deuda tecnica, no bloqueante de build).

## Conclusiones
- El sistema esta funcional y compila, pero hay fallos puntuales que deben corregirse con prioridad en backend/routes/workOrders.js y seguridad de autenticacion.
- Para trazabilidad completa de todas las funciones detectadas (288), revisar function_inventory_clean.txt.

