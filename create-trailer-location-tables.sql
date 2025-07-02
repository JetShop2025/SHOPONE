-- Script SQL para crear las tablas necesarias para Trailer Location
-- Ejecutar en la base de datos del sistema

-- Tabla para almacenar destinatarios de email
CREATE TABLE IF NOT EXISTS trailer_location_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  trailers JSON,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla para configuración de envío automático
CREATE TABLE IF NOT EXISTS trailer_location_schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled BOOLEAN DEFAULT FALSE,
  frequency ENUM('daily', 'weekly', 'manual') DEFAULT 'daily',
  recipients JSON,
  next_send TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertar destinatarios de ejemplo
INSERT IGNORE INTO trailer_location_recipients (name, email, trailers, active) VALUES 
('Manager Central', 'manager@company.com', JSON_ARRAY('3-300', '3-301'), TRUE),
('Dispatcher', 'dispatch@company.com', JSON_ARRAY('1-100', '1-101', '2-01'), TRUE),
('Supervisor de Operaciones', 'ops@company.com', JSON_ARRAY(), TRUE);

-- Insertar configuración inicial de envío automático
INSERT IGNORE INTO trailer_location_schedule (enabled, frequency, recipients) VALUES 
(FALSE, 'daily', JSON_ARRAY());

-- Mostrar tablas creadas
SELECT 'trailer_location_recipients' as tabla, COUNT(*) as registros FROM trailer_location_recipients
UNION ALL
SELECT 'trailer_location_schedule' as tabla, COUNT(*) as registros FROM trailer_location_schedule;
