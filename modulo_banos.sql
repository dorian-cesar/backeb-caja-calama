CREATE DATABASE IF NOT EXISTS terminales;
USE terminales;

-- Tabla de usuarios
CREATE TABLE users (
  id INT(11) NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'cajero') NOT NULL DEFAULT 'cajero',
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla de cajas físicas
CREATE TABLE cajas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_caja INT NOT NULL UNIQUE,
  nombre VARCHAR(50) NOT NULL,
  ubicacion VARCHAR(100),
  estado ENUM('activa', 'inactiva') NOT NULL DEFAULT 'activa',
  descripcion TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla de servicios
CREATE TABLE servicios (
  id INT AUTO_INCREMENT PRIMARY KEY,  
  nombre VARCHAR(100) NOT NULL,
  tipo ENUM('BAÑO', 'DUCHA') NOT NULL,
  precio DECIMAL(10,2) NOT NULL,  
  descripcion TEXT,
  estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla de sesiones de caja (aperturas/cierres)
CREATE TABLE aperturas_cierres (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_caja INT NOT NULL,
  id_usuario_apertura INT NOT NULL,
  id_usuario_cierre INT,
  fecha_apertura DATE NOT NULL,
  hora_apertura TIME NOT NULL,
  fecha_cierre DATE,
  hora_cierre TIME,
  monto_inicial DECIMAL(10,2) NOT NULL,
  total_efectivo DECIMAL(10,2) DEFAULT 0,
  total_tarjeta DECIMAL(10,2) DEFAULT 0,
  total_general DECIMAL(10,2) GENERATED ALWAYS AS (total_efectivo + total_tarjeta) STORED,
  observaciones TEXT,
  estado ENUM('abierta', 'cerrada') NOT NULL DEFAULT 'abierta',
  fue_arqueada BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (numero_caja) REFERENCES cajas(numero_caja),
  FOREIGN KEY (id_usuario_apertura) REFERENCES users(id),
  FOREIGN KEY (id_usuario_cierre) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla de movimientos/transacciones
CREATE TABLE movimientos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_aperturas_cierres INT NOT NULL,
  id_usuario INT NOT NULL,
  id_servicio INT NOT NULL,
  numero_caja INT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  medio_pago ENUM('EFECTIVO', 'TARJETA') NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,  
  codigo VARCHAR(20),  
  FOREIGN KEY (id_aperturas_cierres) REFERENCES aperturas_cierres(id),
  FOREIGN KEY (id_usuario) REFERENCES users(id),
  FOREIGN KEY (id_servicio) REFERENCES servicios(id),
  FOREIGN KEY (numero_caja) REFERENCES cajas(numero_caja)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insertar usuarios
INSERT INTO users (id, username, email, password, role) VALUES
(1, 'admin', 'admin@wit.la', '$2b$10$i5jGaiV0Eo9Rzn7Hd6blp.9HBBGReEeSg0gPADuof9eoxWE9kqcwK', 'admin'),
(2, 'cajero 1', 'cajero1@wit.la', '$2b$10$i5jGaiV0Eo9Rzn7Hd6blp.9HBBGReEeSg0gPADuof9eoxWE9kqcwK', 'cajero'),
(3, 'cajero 2', 'cajero2@wit.la', '$2b$10$i5jGaiV0Eo9Rzn7Hd6blp.9HBBGReEeSg0gPADuof9eoxWE9kqcwK', 'cajero');

-- Insertar cajas físicas
INSERT INTO cajas (numero_caja, nombre, ubicacion) VALUES
(1, 'Caja Principal', 'Entrada principal'),
(2, 'Caja Secundaria', 'Área de duchas'),
(3, 'Caja Terminal', 'Terminal de buses');

-- Insertar servicios disponibles
INSERT INTO servicios (nombre, tipo, precio) VALUES
('Baño estándar', 'BAÑO', 500),
('Ducha básica', 'DUCHA', 4000);
