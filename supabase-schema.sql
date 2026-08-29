-- ================================================================
-- SENDERY CRM — Schema para Supabase (PostgreSQL)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- CUENTAS BANCARIAS
CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  id BIGSERIAL PRIMARY KEY,
  banco TEXT NOT NULL,
  ultimos_4 TEXT NOT NULL,
  titular TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('cheques','ahorro','efectivo')),
  saldo_actual NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROVEEDORES
CREATE TABLE IF NOT EXISTS proveedores (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo_servicio TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  rfc TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  ciudad TEXT DEFAULT 'Ensenada',
  fecha_registro DATE DEFAULT CURRENT_DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EVENTOS
CREATE TABLE IF NOT EXISTS eventos (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('caminata','viaje')),
  fecha DATE NOT NULL,
  lugar TEXT NOT NULL,
  ejecutor TEXT NOT NULL,
  costo_total NUMERIC DEFAULT 0,
  cupo_maximo INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo','cerrado','cancelado')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PARTICIPANTES
CREATE TABLE IF NOT EXISTS participantes (
  id BIGSERIAL PRIMARY KEY,
  evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  cliente_id BIGINT REFERENCES clientes(id),
  nombre_cliente TEXT NOT NULL,
  monto_total_acordado NUMERIC DEFAULT 0,
  saldo_pendiente NUMERIC DEFAULT 0,
  cuenta_destino_pago TEXT,
  fecha_ultimo_pago DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ABONOS
CREATE TABLE IF NOT EXISTS abonos (
  id BIGSERIAL PRIMARY KEY,
  participante_id BIGINT NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  evento_id BIGINT NOT NULL REFERENCES eventos(id),
  cliente_id BIGINT REFERENCES clientes(id),
  fecha DATE NOT NULL,
  monto NUMERIC NOT NULL,
  referencia TEXT,
  cuenta_destino TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GASTOS
CREATE TABLE IF NOT EXISTS gastos (
  id BIGSERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  concepto TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK(categoria IN ('transporte','alimentación','hospedaje','equipo','marketing','otro')),
  importe NUMERIC NOT NULL,
  moneda TEXT DEFAULT 'MXN',
  ubicacion TEXT,
  evento_id BIGINT REFERENCES eventos(id),
  proveedor_id BIGINT REFERENCES proveedores(id),
  cuenta_bancaria_id BIGINT REFERENCES cuentas_bancarias(id),
  comprobante TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAGOS A PROVEEDORES
CREATE TABLE IF NOT EXISTS pagos_proveedores (
  id BIGSERIAL PRIMARY KEY,
  proveedor_id BIGINT NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  concepto TEXT NOT NULL,
  importe NUMERIC NOT NULL,
  cuenta_bancaria_id BIGINT REFERENCES cuentas_bancarias(id),
  referencia TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MOVIMIENTOS BANCARIOS
CREATE TABLE IF NOT EXISTS movimientos (
  id BIGSERIAL PRIMARY KEY,
  cuenta_id BIGINT NOT NULL REFERENCES cuentas_bancarias(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso')),
  concepto TEXT NOT NULL,
  importe NUMERIC NOT NULL,
  referencia TEXT,
  evento_id BIGINT REFERENCES eventos(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único parcial para evitar movimientos duplicados en importación
CREATE UNIQUE INDEX IF NOT EXISTS movimientos_ref_unique
  ON movimientos(referencia)
  WHERE referencia IS NOT NULL AND referencia != '';

-- LOG DE IMPORTACIONES EXCEL
CREATE TABLE IF NOT EXISTS excel_imports_log (
  folio TEXT PRIMARY KEY,
  tipo TEXT,
  evento_id BIGINT,
  fecha_import TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- DATOS DE EJEMPLO (opcional — ejecutar solo si se desea seed)
-- ================================================================

INSERT INTO cuentas_bancarias (banco, ultimos_4, titular, tipo, saldo_actual) VALUES
  ('BBVA', '4521', 'Sendery Outdoor Lifestyle', 'cheques', 84500.00),
  ('Bancomer', '8834', 'Sendery Outdoor Lifestyle', 'ahorro', 32000.00),
  ('Efectivo', '0000', 'Caja Chica Sendery', 'efectivo', 6800.00)
ON CONFLICT DO NOTHING;

INSERT INTO proveedores (nombre, tipo_servicio, telefono, email, rfc) VALUES
  ('Transportes Baja Norte', 'Transporte turístico', '646-123-4567', 'contacto@bajatrans.mx', 'TBN920301ABC'),
  ('Hotel Misión Ensenada', 'Hospedaje', '646-178-3000', 'reservas@misionensenada.mx', 'HME841105XYZ'),
  ('Mariscos El Güero', 'Alimentación', '646-152-9988', NULL, 'MEG750620DEF'),
  ('Equipo Outdoor BC', 'Equipo y gear', '646-200-4455', 'ventas@outdoorbc.mx', 'EOB180910GHI'),
  ('Diseño Costero Mx', 'Marketing / Diseño', NULL, 'hola@disenocostero.mx', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO clientes (nombre, telefono, email, ciudad, fecha_registro) VALUES
  ('Alejandro Ruiz Mendoza', '664-301-2210', 'aruiz@gmail.com', 'Tijuana', '2024-09-15'),
  ('Fernanda Castro Leal', '646-112-8834', 'fcastro@hotmail.com', 'Ensenada', '2024-10-02'),
  ('Marco Antonio Villanueva', '664-455-6677', 'marco.v@outlook.com', 'Mexicali', '2024-10-18'),
  ('Sofía Elizondo Bravo', '646-200-3311', 'sofia.eli@gmail.com', 'Ensenada', '2024-11-05'),
  ('Jesús Alberto Morales', '664-789-0021', 'jmorales@empresa.mx', 'Tijuana', '2024-11-20'),
  ('Diana Luz Herrera', '646-333-4455', 'dianaherrera@gmail.com', 'Ensenada', '2025-01-08'),
  ('Ricardo Fuentes Tapia', '664-521-6603', 'rfuentes@gmail.com', 'Tijuana', '2025-01-22'),
  ('Valeria Montoya Cruz', '646-411-7789', 'vmontoya@yahoo.com', 'Ensenada', '2025-02-10'),
  ('Carlos Ibarra Noriega', '686-100-2233', 'carlos.ibarra@gmail.com', 'Mexicali', '2025-02-28'),
  ('Lucía Palomares Rueda', '664-600-8821', 'luciapalomares@gmail.com', 'Tijuana', '2025-03-05')
ON CONFLICT DO NOTHING;
