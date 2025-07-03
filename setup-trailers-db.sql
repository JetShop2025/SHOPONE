-- Script SQL para crear tabla de trailers en la base de datos
-- Ejecutar este script en MySQL/MariaDB

USE your_database_name; -- Cambiar por tu nombre de base de datos

-- Crear tabla de trailers
CREATE TABLE IF NOT EXISTS trailers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trailer_number VARCHAR(50) UNIQUE NOT NULL,
    asset_id VARCHAR(100),
    status ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE') DEFAULT 'ACTIVE',
    last_known_location VARCHAR(255),
    last_latitude DECIMAL(10, 8),
    last_longitude DECIMAL(11, 8),
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Insertar algunos trailers de ejemplo
INSERT INTO trailers (trailer_number, asset_id, status, last_known_location, last_latitude, last_longitude) VALUES
('3-300', 'asset-3300', 'ACTIVE', 'San Juan, PR', 18.4655, -66.1057),
('3-301', 'asset-3301', 'ACTIVE', 'Bayamón, PR', 18.3985, -66.1614),
('1-100', 'asset-1100', 'MAINTENANCE', 'Carolina, PR', 18.3894, -65.9568),
('1-101', 'asset-1101', 'ACTIVE', 'Caguas, PR', 18.2342, -66.0413),
('2-01', 'asset-201', 'ACTIVE', 'Ponce, PR', 18.0113, -66.6140);

-- Crear tabla para historial de ubicaciones
CREATE TABLE IF NOT EXISTS trailer_location_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trailer_id INT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    speed DECIMAL(5, 2),
    direction INT,
    address VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trailer_id) REFERENCES trailers(id)
);

-- Verificar que los datos se insertaron correctamente
SELECT * FROM trailers;
