# 📋 Sistema de Gestión de Órdenes de Trabajo - Manual de Usuario

## **🔍 Encontrar Órdenes de Trabajo**

### **Búsqueda Rápida por Número de O.T.**
1. Busca el campo **"🔍 Search ID Classic"** en la parte superior
2. Escribe el número de la orden de trabajo (ejemplo: "19417")
3. Presiona **Enter** o espera un momento
4. El sistema encontrará la orden **incluso si tienes miles de registros**
5. Haz clic en el botón **✕** para volver a la vista normal

### **Filtros Regulares**
- **Filter by ID Classic**: Solo busca en las órdenes actualmente cargadas
- **Filter by Status**: PROCESSING, APPROVED, FINISHED
- **Filter by Week/Day**: Usa los selectores de fecha

---

## **📊 Entendiendo los Modos del Sistema**

### **Modo Normal** (Base de Datos Pequeña)
- Muestra todas las órdenes de trabajo a la vez
- Filtrado y búsqueda rápidos
- No necesita controles de página

### **Modo Escalable** (Base de Datos Grande)
Cuando veas el indicador **📊 SCALABLE MODE**:
- El sistema carga las órdenes por páginas para mejor rendimiento
- Usa los botones **← Prev** y **Next →** para navegar
- Muestra el número total de órdenes en tu base de datos

### **Órdenes Archivadas**
- Checkbox **"Include Old W.O. (>2 years)"**
- Cuando está **desmarcado**: Muestra solo órdenes recientes (más rápido)
- Cuando está **marcado**: Muestra todas las órdenes históricas
- Se optimiza automáticamente para bases de datos grandes

---

## **➕ Crear Nuevas Órdenes de Trabajo**

1. Haz clic en **"Nueva Work Order"**
2. Completa los campos requeridos:
   - **Trailer**: Selecciona del menú desplegable
   - **Status**: PROCESSING, APPROVED, o FINISHED
   - **Date**: Elige la fecha
   - **Mechanics**: Agrega miembros del equipo
   - **Total Hours**: Ingresa tiempo de trabajo
3. **Agregar Partes** (si es necesario):
   - Busca en el inventario por nombre/número de parte
   - Selecciona cantidad necesaria
   - Las partes se deducen automáticamente del inventario
4. **ID Classic**: Solo requerido cuando el estado es FINISHED
5. Haz clic en **"Guardar Work Order"**

---

## **✏️ Editar Órdenes de Trabajo**

1. Encuentra la orden de trabajo (usa la búsqueda si es necesario)
2. Haz clic en el botón **Edit**
3. Ingresa **contraseña**: `2025`
4. Realiza tus cambios
5. **Importante**: ID Classic solo se puede establecer cuando el estado es FINISHED
6. Haz clic en **Save Changes**

---

## **📄 Generar Reportes**

### **Reportes PDF**
1. Haz clic en **"Generate PDF"** en cualquier orden de trabajo
2. El PDF incluye automáticamente:
   - Detalles de la orden de trabajo
   - Partes usadas con costos
   - Horas de trabajo y tarifas
   - Costos totales
3. El PDF se guarda y puede reimprimirse en cualquier momento

### **Exportar a Excel**
1. Haz clic en **"Exportar a Excel"**
2. Elige rango de fechas o exportar todo
3. Incluye todos los datos de órdenes para análisis

---

## **🔄 Indicadores de Estado del Sistema**

### **Estado del Servidor**
- **🟢 Online**: Sistema funcionando normalmente
- **🟡 Waking up**: Servidor iniciando (espera un momento)
- **🔴 Offline**: Problemas de conexión (haz clic en Reconnect)

### **Estado de Búsqueda**
- **🔍 SEARCHING**: Búsqueda activa de orden específica
- Muestra lo que estás buscando

### **Indicadores de Carga**
- **Loading...**: Datos siendo cargados
- **Processing...**: Orden de trabajo siendo guardada
- Ten paciencia durante estas operaciones

---

## **💡 Consejos para Mejor Rendimiento**

### **Para Bases de Datos Grandes (1000+ Órdenes)**
1. Usa **🔍 Search ID Classic** para encontrar órdenes específicas rápidamente
2. Mantén **Include Old W.O.** desmarcado para trabajo diario
3. Usa filtros de fecha para reducir resultados
4. Navega por páginas en lugar de cargar todo a la vez

### **Flujo de Trabajo Diario**
1. Revisa órdenes recientes (vista por defecto)
2. Usa búsqueda para encontrar órdenes específicas
3. Crea nuevas órdenes según sea necesario
4. Genera PDFs para trabajo completado
5. Usa exportación a Excel para reportes mensuales

---

## **⚠️ Notas Importantes**

### **Reglas de ID Classic**
- Solo se puede establecer cuando el estado es **FINISHED**
- Debe ser único en todas las órdenes de trabajo
- Requerido para órdenes terminadas
- El sistema previene duplicados

### **Gestión de Partes**
- Las partes se deducen automáticamente del inventario
- Revisa el inventario antes de crear órdenes grandes
- Recibe nuevas partes en la sección de Inventario

### **Protección por Contraseña**
- Editar requiere contraseña: `2025`
- Protege contra cambios accidentales
- Todas las ediciones se registran para auditoría

---

## **🔧 Solución de Problemas**

### **No Puedo Encontrar una Orden de Trabajo**
1. Prueba **🔍 Search ID Classic** en lugar del filtro regular
2. Verifica si **Include Old W.O.** necesita estar habilitado
3. Confirma que el número de orden sea correcto

### **Sistema Funcionando Lento**
1. Usa búsqueda en lugar de explorar todos los registros
2. Mantén **Include Old W.O.** desmarcado
3. Cierra y reabre el navegador si es necesario
4. Revisa el indicador de estado del servidor

### **PDF No Se Genera**
1. Verifica conexión a internet
2. Espera a que complete cualquier "Processing..."
3. Intenta refrescar la página
4. Contacta soporte técnico si persiste

---

## **📞 Soporte**

Para problemas técnicos o preguntas:
1. Revisa primero los indicadores de estado del servidor
2. Intenta refrescar el navegador
3. Verifica conexión a internet
4. Contacta al administrador del sistema

**El sistema está diseñado para manejar el crecimiento de la empresa automáticamente - desde cientos hasta miles de órdenes de trabajo sin pérdida de rendimiento.**