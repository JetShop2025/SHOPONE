// Script para configurar las tablas de Trailer Location en la base de datos
require('dotenv').config({ path: './backend/.env' });
const db = require('./backend/db');
const fs = require('fs');
const path = require('path');

async function setupTrailerLocationTables() {
  console.log('🔧 Configurando tablas de Trailer Location...\n');
  
  try {
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'create-trailer-location-tables.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      // Dividir las declaraciones SQL (mejorado)
    const statements = sqlContent
      .split(/;(?=\s*(?:CREATE|INSERT|SELECT|--|\s*$))/i)
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && stmt !== 'SELECT');
    
    console.log(`📝 Ejecutando ${statements.length} declaraciones SQL...\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.toLowerCase().includes('create table')) {
        const tableName = statement.match(/CREATE TABLE.*?`?(\w+)`?/i)?.[1] || 'unknown';
        console.log(`📋 Creando tabla: ${tableName}`);
      } else if (statement.toLowerCase().includes('insert')) {
        console.log(`📥 Insertando datos de ejemplo`);
      } else if (statement.toLowerCase().includes('select')) {
        console.log(`📊 Verificando datos`);
      }
      
      try {
        const [result] = await db.query(statement);
        
        if (statement.toLowerCase().includes('select')) {
          console.log('   Resultado:', result);
        } else {
          console.log(`   ✅ Ejecutado correctamente`);
        }
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('Duplicate entry')) {
          console.log(`   ⚠️  Ya existe (saltando)`);
        } else {
          console.log(`   ❌ Error: ${error.message}`);
        }
      }
    }
    
    console.log('\n✅ Configuración de base de datos completada');
    
    // Verificar que las tablas fueron creadas correctamente
    console.log('\n🔍 Verificando configuración...');
    
    try {
      const [recipients] = await db.query('SELECT COUNT(*) as count FROM trailer_location_recipients');
      console.log(`📧 Destinatarios configurados: ${recipients[0].count}`);
      
      const [schedules] = await db.query('SELECT COUNT(*) as count FROM trailer_location_schedule');
      console.log(`⏰ Configuraciones de envío: ${schedules[0].count}`);
      
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
