-- ============================================================
-- ESQUEMA DE REFERENCIA — Sistema Mantenimiento (producción)
-- Proyecto Supabase: vbbrhzclzrpwzlbqmsvk
--
-- Este archivo documenta la estructura REAL que ya existe en producción
-- (generado a partir del esquema en vivo). Es solo referencia/disaster
-- recovery: NO lo ejecutes contra la base de datos actual, ya tiene
-- estas tablas creadas y con datos reales.
--
-- La versión anterior de este archivo estaba desactualizada (le
-- faltaban 5 de las 9 tablas reales, incluida "reportes") y además
-- empezaba con DROP TABLE ... CASCADE, lo cual habría borrado todos
-- los reportes y usuarios reales si alguien lo llegaba a ejecutar.
--
-- Para la configuración de seguridad (RLS, hash de contraseñas, etc.)
-- ver supabase_migration_seguridad.sql en esta misma carpeta.
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL,
    estaciones VARCHAR(100) NOT NULL,
    permiso_dashboard BOOLEAN DEFAULT false,
    permiso_soluciones BOOLEAN DEFAULT true,
    permiso_inventario BOOLEAN DEFAULT false,
    permiso_config BOOLEAN DEFAULT false,
    permiso_editar_reportes BOOLEAN DEFAULT false,
    permiso_grifos BOOLEAN DEFAULT true,
    permiso_unidades BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS estaciones (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    productos_disponibles VARCHAR(255),
    cantidad_islas INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS islas_lados (
    id SERIAL PRIMARY KEY,
    estacion_id VARCHAR(50) REFERENCES estaciones(id) ON DELETE CASCADE,
    isla INTEGER NOT NULL,
    lado INTEGER NOT NULL,
    productos VARCHAR(255) NOT NULL,
    activo BOOLEAN DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_islas_lados_estacion_id ON islas_lados(estacion_id);

CREATE TABLE IF NOT EXISTS inventario (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    stock INTEGER DEFAULT 0,
    estacion VARCHAR(100) NOT NULL,
    estado VARCHAR(50) DEFAULT 'Crítico',
    creado_por VARCHAR(100),
    creado_en TIMESTAMP DEFAULT now(),
    modulo VARCHAR(50) DEFAULT 'grifo'
);

CREATE TABLE IF NOT EXISTS inventario_movimientos (
    id SERIAL PRIMARY KEY,
    inventario_id INTEGER REFERENCES inventario(id),
    tipo VARCHAR(50),
    cantidad INTEGER,
    motivo VARCHAR(255),
    creado_por VARCHAR(100),
    creado_en TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_inventario_id ON inventario_movimientos(inventario_id);

CREATE TABLE IF NOT EXISTS mantenimiento_tipos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE,
    modulo VARCHAR(50) DEFAULT 'grifo'
);

CREATE TABLE IF NOT EXISTS unidades_tractos (
    id SERIAL PRIMARY KEY,
    placa VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS unidades_carretas (
    id SERIAL PRIMARY KEY,
    placa VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS reportes (
    id SERIAL PRIMARY KEY,
    estacion_id VARCHAR(100),
    isla_lado VARCHAR(100),
    producto VARCHAR(150),
    motivo VARCHAR(150),
    descripcion TEXT,
    fotos TEXT,
    creado_por VARCHAR(100),
    creado_en TIMESTAMP DEFAULT now(),
    modulo VARCHAR(50) DEFAULT 'grifo',
    tracto_placa VARCHAR(50),
    carreta_placa VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_reportes_creado_en ON reportes(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_reportes_estacion_id ON reportes(estacion_id);
