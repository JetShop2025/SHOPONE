// Script simplificado para configurar las tablas de Trailer Location
require('dotenv').config({ path: './backend/.env' });
const db = require('./backend/db');

async function setupTrailerLocationTables() {
  console.log('🔧 Configurando tablas de Trailer Location...\n');
  
  try {
    // Crear tabla de destinatarios
    console.log('📋 Creando tabla trailer_location_recipients...');
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS trailer_location_recipients (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          trailers JSON,
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Tabla trailer_location_recipients creada');
    } catch (error) {
      console.log('   ⚠️  Error creando tabla:', error.message);
    }

    // Crear tabla de configuración
    console.log('📋 Creando tabla trailer_location_schedule...');
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS trailer_location_schedule (
          id INT AUTO_INCREMENT PRIMARY KEY,
          enabled BOOLEAN DEFAULT FALSE,
          frequency ENUM('daily', 'weekly', 'manual') DEFAULT 'daily',
          recipients JSON,
          next_send TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Tabla trailer_location_schedule creada');
    } catch (error) {
      console.log('   ⚠️  Error creando tabla:', error.message);
    }

    // Insertar datos de ejemplo
    console.log('📥 Insertando destinatarios de ejemplo...');
    try {
      await db.query(`
        INSERT IGNORE INTO trailer_location_recipients (name, email, trailers, active) VALUES 
        ('Manager Central', 'manager@company.com', JSON_ARRAY('3-300', '3-301'), TRUE),
        ('Dispatcher', 'dispatch@company.com', JSON_ARRAY('1-100', '1-101', '2-01'), TRUE),
        ('Supervisor de Operaciones', 'ops@company.com', JSON_ARRAY(), TRUE)
      `);
      console.log('   ✅ Destinatarios insertados');
    } catch (error) {
      console.log('   ⚠️  Error insertando destinatarios:', error.message);
    }

    // Insertar configuración inicial
    console.log('📥 Insertando configuración de envío...');
    try {
      await db.query(`
        INSERT IGNORE INTO trailer_location_schedule (enabled, frequency, recipients) VALUES 
        (FALSE, 'daily', JSON_ARRAY())
      `);
      console.log('   ✅ Configuración insertada');
    } catch (error) {
      console.log('   ⚠️  Error insertando configuración:', error.message);
    }
    
    console.log('\n✅ Configuración de base de datos completada');
    
    // Verificar que las tablas fueron creadas correctamente
    console.log('\n🔍 Verificando configuración...');
    
    try {
      const [recipients] = await db.query('SELECT COUNT(*) as count FROM trailer_location_recipients');
      console.log(`📧 Destinatarios configurados: ${recipients[0].count}`);
      
      const [schedules] = await db.query('SELECT COUNT(*) as count FROM trailer_location_schedule');
      console.log(`⏰ Configuraciones de envío: ${schedules[0].count}`);
      
      // Mostrar destinatarios
      const [recipientList] = await db.query('SELECT name, email, active FROM trailer_location_recipients');
      console.log('\n👥 Destinatarios configurados:');
      recipientList.forEach((recipient, index) => {
        console.log(`   ${index + 1}. ${recipient.name} (${recipient.email}) - ${recipient.active ? 'Activo' : 'Inactivo'}`);
      });
      
      console.log('\n🎉 ¡Base de datos configurada exitosamente!');
    } catch (error) {
      console.log('\n❌ Error verificando configuración:', error.message);
    }
    
  } catch (error) {
    console.error('💥 Error configurando base de datos:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Ejecutar configuración
setupTrailerLocationTables();
