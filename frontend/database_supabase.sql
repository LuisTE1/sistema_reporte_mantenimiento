-- SCRIPT PARA EJECUTAR EN EL SQL EDITOR DE SUPABASE (100% REAL, SIN BASURA)

-- Para asegurarnos de borrar toda la basura anterior, borramos las tablas si existen
DROP TABLE IF EXISTS inventario CASCADE;
DROP TABLE IF EXISTS islas_lados CASCADE;
DROP TABLE IF EXISTS estaciones CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- 1. Tabla de Usuarios y Privilegios ABAC
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- NUEVO: Contraseña obligatoria
    rol VARCHAR(50) NOT NULL,
    estaciones VARCHAR(100) NOT NULL,
    permiso_dashboard BOOLEAN DEFAULT false,
    permiso_soluciones BOOLEAN DEFAULT true,
    permiso_inventario BOOLEAN DEFAULT false,
    permiso_config BOOLEAN DEFAULT false
);

-- 2. Tabla de Estaciones
CREATE TABLE estaciones (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

-- 3. Tabla de Islas, Lados y Productos
CREATE TABLE islas_lados (
    id SERIAL PRIMARY KEY,
    estacion_id VARCHAR(50) REFERENCES estaciones(id) ON DELETE CASCADE,
    isla INTEGER NOT NULL,
    lado INTEGER NOT NULL,
    productos VARCHAR(100) NOT NULL
);

-- 4. Tabla de Inventario Global
CREATE TABLE inventario (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    stock INTEGER DEFAULT 0,
    estacion VARCHAR(100) NOT NULL,
    estado VARCHAR(50) DEFAULT 'Crítico'
);

-- APAGAR SEGURIDAD (RLS) TEMPORALMENTE PARA EL PROTOTIPO
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE estaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE islas_lados DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventario DISABLE ROW LEVEL SECURITY;

-- ÚNICO DATO NECESARIO: Crear el primer usuario Gerente para que no te quedes fuera del sistema
INSERT INTO usuarios (nombre, password, rol, estaciones, permiso_dashboard, permiso_soluciones, permiso_inventario, permiso_config)
VALUES ('GERENTE', '123456', 'Gerencia', 'Todas', true, true, true, true);
