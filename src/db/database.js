// ═══════════════════════════════════════════════════════════════
// SENDERY CRM — Capa de Base de Datos (sql.js + IndexedDB)
// SQLite en el navegador con persistencia automática
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'sendery_crm_v1'
const DB_KEY = 'sendery_db_data'

let db = null
let SQL = null

// ── Inicializar sql.js ──────────────────────────────────────────
export async function initDatabase() {
  if (db) return db

  // Cargar sql.js desde CDN (WASM)
  const script = document.createElement('script')
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js'
  document.head.appendChild(script)

  await new Promise((resolve, reject) => {
    script.onload = resolve
    script.onerror = reject
  })

  SQL = await window.initSqlJs({
    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
  })

  // Intentar cargar DB existente desde IndexedDB
  const savedData = await loadFromIndexedDB()
  if (savedData) {
    db = new SQL.Database(savedData)
  } else {
    db = new SQL.Database()
    createSchema()
    insertSeedData()
    await saveToIndexedDB()
  }

  return db
}

// ── Esquema de tablas ───────────────────────────────────────────
function createSchema() {
  db.run(`
    -- EVENTOS
    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('caminata','viaje')),
      fecha TEXT NOT NULL,
      lugar TEXT NOT NULL,
      ejecutor TEXT NOT NULL,
      costo_total REAL DEFAULT 0,
      cupo_maximo INTEGER DEFAULT 0,
      estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo','cerrado','cancelado')),
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- PARTICIPANTES DE EVENTOS (subregistro)
    CREATE TABLE IF NOT EXISTS participantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
      cliente_id INTEGER REFERENCES clientes(id),
      nombre_cliente TEXT NOT NULL,
      monto_total_acordado REAL DEFAULT 0,
      saldo_pendiente REAL DEFAULT 0,
      cuenta_destino_pago TEXT,
      fecha_ultimo_pago TEXT,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- ABONOS por participante
    CREATE TABLE IF NOT EXISTS abonos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participante_id INTEGER NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
      evento_id INTEGER NOT NULL,
      cliente_id INTEGER,
      fecha TEXT NOT NULL,
      monto REAL NOT NULL,
      referencia TEXT,
      cuenta_destino TEXT,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- CLIENTES (CRM)
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      ciudad TEXT DEFAULT 'Ensenada',
      fecha_registro TEXT DEFAULT (date('now','localtime')),
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- GASTOS
    CREATE TABLE IF NOT EXISTS gastos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      concepto TEXT NOT NULL,
      categoria TEXT NOT NULL CHECK(categoria IN ('transporte','alimentación','hospedaje','equipo','marketing','otro')),
      importe REAL NOT NULL,
      moneda TEXT DEFAULT 'MXN',
      ubicacion TEXT,
      evento_id INTEGER REFERENCES eventos(id),
      proveedor_id INTEGER REFERENCES proveedores(id),
      cuenta_bancaria_id INTEGER REFERENCES cuentas_bancarias(id),
      comprobante TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- PROVEEDORES
    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo_servicio TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      rfc TEXT,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- PAGOS A PROVEEDORES
    CREATE TABLE IF NOT EXISTS pagos_proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor_id INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      concepto TEXT NOT NULL,
      importe REAL NOT NULL,
      cuenta_bancaria_id INTEGER REFERENCES cuentas_bancarias(id),
      referencia TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- CUENTAS BANCARIAS
    CREATE TABLE IF NOT EXISTS cuentas_bancarias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      banco TEXT NOT NULL,
      ultimos_4 TEXT NOT NULL,
      titular TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('cheques','ahorro','efectivo')),
      saldo_actual REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- MOVIMIENTOS DE CUENTAS
    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cuenta_id INTEGER NOT NULL REFERENCES cuentas_bancarias(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso')),
      concepto TEXT NOT NULL,
      importe REAL NOT NULL,
      referencia TEXT,
      evento_id INTEGER REFERENCES eventos(id),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)
}

// ── Datos de ejemplo realistas (Ensenada / BC) ──────────────────
function insertSeedData() {
  // Cuentas bancarias
  db.run(`INSERT INTO cuentas_bancarias (banco, ultimos_4, titular, tipo, saldo_actual) VALUES
    ('BBVA', '4521', 'Sendery Outdoor Lifestyle', 'cheques', 84500.00),
    ('Bancomer', '8834', 'Sendery Outdoor Lifestyle', 'ahorro', 32000.00),
    ('Efectivo', '0000', 'Caja Chica Sendery', 'efectivo', 6800.00)
  `)

  // Proveedores
  db.run(`INSERT INTO proveedores (nombre, tipo_servicio, telefono, email, rfc) VALUES
    ('Transportes Baja Norte', 'Transporte turístico', '646-123-4567', 'contacto@bajatrans.mx', 'TBN920301ABC'),
    ('Hotel Misión Ensenada', 'Hospedaje', '646-178-3000', 'reservas@misionensenada.mx', 'HME841105XYZ'),
    ('Mariscos El Güero', 'Alimentación', '646-152-9988', NULL, 'MEG750620DEF'),
    ('Equipo Outdoor BC', 'Equipo y gear', '646-200-4455', 'ventas@outdoorbc.mx', 'EOB180910GHI'),
    ('Diseño Costero Mx', 'Marketing / Diseño', NULL, 'hola@disenocostero.mx', NULL)
  `)

  // Clientes
  db.run(`INSERT INTO clientes (nombre, telefono, email, ciudad, fecha_registro) VALUES
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
  `)

  // Eventos
  db.run(`INSERT INTO eventos (nombre, tipo, fecha, lugar, ejecutor, costo_total, cupo_maximo, estado) VALUES
    ('Caminata Sierra Juárez — Amanecer', 'caminata', '2025-02-08', 'Sierra de Juárez, BC', 'Miguel Ángel Torres', 12500.00, 15, 'cerrado'),
    ('Viaje Guadalupe + Ruta del Vino', 'viaje', '2025-03-15', 'Valle de Guadalupe, Ensenada', 'Laura Sandoval', 38000.00, 20, 'cerrado'),
    ('Caminata Punta Banda — Atardecer', 'caminata', '2025-04-05', 'Punta Banda, Ensenada', 'Miguel Ángel Torres', 9800.00, 12, 'activo'),
    ('Expedición Las Ánimas — Baja Kayak', 'viaje', '2025-05-10', 'Bahía de los Ángeles, BCS', 'Laura Sandoval', 55000.00, 10, 'activo'),
    ('Caminata Cañón Guadalupe — Aguas Termales', 'caminata', '2025-06-21', 'Cañón Guadalupe, Mexicali', 'Miguel Ángel Torres', 18000.00, 18, 'activo')
  `)

  // Participantes con abonos para evento 1 (cerrado)
  db.run(`INSERT INTO participantes (evento_id, cliente_id, nombre_cliente, monto_total_acordado, saldo_pendiente, cuenta_destino_pago) VALUES
    (1, 1, 'Alejandro Ruiz Mendoza', 850.00, 0.00, 'BBVA 4521'),
    (1, 2, 'Fernanda Castro Leal', 850.00, 0.00, 'BBVA 4521'),
    (1, 3, 'Marco Antonio Villanueva', 850.00, 0.00, 'BBVA 4521'),
    (1, 5, 'Jesús Alberto Morales', 850.00, 0.00, 'Efectivo'),
    (2, 1, 'Alejandro Ruiz Mendoza', 1900.00, 0.00, 'BBVA 4521'),
    (2, 4, 'Sofía Elizondo Bravo', 1900.00, 500.00, 'BBVA 4521'),
    (2, 6, 'Diana Luz Herrera', 1900.00, 0.00, 'Bancomer 8834'),
    (3, 2, 'Fernanda Castro Leal', 820.00, 300.00, 'BBVA 4521'),
    (3, 7, 'Ricardo Fuentes Tapia', 820.00, 820.00, 'BBVA 4521'),
    (3, 8, 'Valeria Montoya Cruz', 820.00, 0.00, 'Efectivo'),
    (4, 9, 'Carlos Ibarra Noriega', 5500.00, 2000.00, 'BBVA 4521'),
    (4, 10, 'Lucía Palomares Rueda', 5500.00, 5500.00, 'BBVA 4521'),
    (5, 3, 'Marco Antonio Villanueva', 1000.00, 500.00, 'Bancomer 8834'),
    (5, 5, 'Jesús Alberto Morales', 1000.00, 0.00, 'BBVA 4521')
  `)

  // Abonos
  db.run(`INSERT INTO abonos (participante_id, evento_id, cliente_id, fecha, monto, referencia, cuenta_destino) VALUES
    (1, 1, 1, '2025-01-20', 850.00, 'TRF-001', 'BBVA 4521'),
    (2, 1, 2, '2025-01-22', 850.00, 'TRF-002', 'BBVA 4521'),
    (3, 1, 3, '2025-01-25', 850.00, 'EFE-003', 'BBVA 4521'),
    (4, 1, 5, '2025-02-01', 850.00, 'EFE-004', 'Efectivo'),
    (5, 2, 1, '2025-02-10', 1900.00, 'TRF-010', 'BBVA 4521'),
    (6, 2, 4, '2025-02-12', 1400.00, 'TRF-011', 'BBVA 4521'),
    (7, 2, 6, '2025-02-15', 1900.00, 'TRF-012', 'Bancomer 8834'),
    (8, 3, 2, '2025-03-20', 520.00, 'TRF-020', 'BBVA 4521'),
    (10, 3, 8, '2025-03-22', 820.00, 'EFE-021', 'Efectivo'),
    (11, 4, 9, '2025-03-01', 3500.00, 'TRF-030', 'BBVA 4521'),
    (13, 5, 3, '2025-04-01', 500.00, 'TRF-040', 'Bancomer 8834'),
    (14, 5, 5, '2025-04-02', 1000.00, 'TRF-041', 'BBVA 4521')
  `)

  // Gastos
  db.run(`INSERT INTO gastos (fecha, concepto, categoria, importe, evento_id, proveedor_id, cuenta_bancaria_id, ubicacion) VALUES
    ('2025-02-06', 'Renta de camioneta Sierra Juárez', 'transporte', 3200.00, 1, 1, 1, 'Ensenada → Sierra de Juárez'),
    ('2025-02-07', 'Desayuno guiado para 15 personas', 'alimentación', 2100.00, 1, 3, 3, 'Sierra de Juárez'),
    ('2025-02-08', 'Hidratación y snacks', 'alimentación', 850.00, 1, NULL, 3, 'Sierra de Juárez'),
    ('2025-03-14', 'Autobús turístico Valle Guadalupe', 'transporte', 8500.00, 2, 1, 1, 'Ensenada → Valle Guadalupe'),
    ('2025-03-14', 'Hospedaje 2 noches Hotel Misión', 'hospedaje', 12000.00, 2, 2, 1, 'Ensenada'),
    ('2025-03-15', 'Cenas y degustaciones ruta del vino', 'alimentación', 9800.00, 2, 3, 1, 'Valle de Guadalupe'),
    ('2025-01-10', 'Publicidad en redes sociales Enero', 'marketing', 2500.00, NULL, 5, 1, 'Online'),
    ('2025-02-01', 'Publicidad redes Febrero', 'marketing', 2500.00, NULL, 5, 1, 'Online'),
    ('2025-03-01', 'Cascos y cuerdas — reposición equipo', 'equipo', 4800.00, NULL, 4, 1, 'Ensenada')
  `)

  // Movimientos bancarios
  db.run(`INSERT INTO movimientos (cuenta_id, fecha, tipo, concepto, importe, referencia, evento_id) VALUES
    (1, '2025-01-20', 'ingreso', 'Abono Alejandro Ruiz — Sierra Juárez', 850.00, 'TRF-001', 1),
    (1, '2025-01-22', 'ingreso', 'Abono Fernanda Castro — Sierra Juárez', 850.00, 'TRF-002', 1),
    (1, '2025-01-25', 'ingreso', 'Abono Marco Villanueva — Sierra Juárez', 850.00, 'EFE-003', 1),
    (3, '2025-02-01', 'ingreso', 'Abono Jesús Morales — Sierra Juárez (efectivo)', 850.00, 'EFE-004', 1),
    (1, '2025-02-06', 'egreso', 'Transporte Sierra Juárez — Baja Norte', 3200.00, 'PAG-001', 1),
    (3, '2025-02-07', 'egreso', 'Desayuno guiado Sierra Juárez', 2100.00, 'PAG-002', 1),
    (3, '2025-02-08', 'egreso', 'Hidratación y snacks Sierra Juárez', 850.00, 'PAG-003', 1),
    (1, '2025-02-10', 'ingreso', 'Abono Alejandro Ruiz — Guadalupe', 1900.00, 'TRF-010', 2),
    (1, '2025-02-12', 'ingreso', 'Abono Sofía Elizondo — Guadalupe (parcial)', 1400.00, 'TRF-011', 2),
    (2, '2025-02-15', 'ingreso', 'Abono Diana Herrera — Guadalupe', 1900.00, 'TRF-012', 2),
    (1, '2025-03-14', 'egreso', 'Autobús Valle Guadalupe', 8500.00, 'PAG-010', 2),
    (1, '2025-03-14', 'egreso', 'Hospedaje Hotel Misión 2 noches', 12000.00, 'PAG-011', 2),
    (1, '2025-03-15', 'egreso', 'Cenas y degustaciones vino', 9800.00, 'PAG-012', 2),
    (1, '2025-01-10', 'egreso', 'Publicidad redes sociales Enero', 2500.00, 'PAG-020', NULL),
    (1, '2025-02-01', 'egreso', 'Publicidad redes sociales Febrero', 2500.00, 'PAG-021', NULL),
    (1, '2025-03-01', 'egreso', 'Reposición equipo outdoor', 4800.00, 'PAG-022', NULL)
  `)
}

// ── Persistencia en IndexedDB ───────────────────────────────────
async function saveToIndexedDB() {
  if (!db) return
  const data = db.export()
  const buffer = new Uint8Array(data)

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('data')
    }
    req.onsuccess = e => {
      const idb = e.target.result
      const tx = idb.transaction('data', 'readwrite')
      tx.objectStore('data').put(buffer, DB_KEY)
      tx.oncomplete = () => { idb.close(); resolve() }
      tx.onerror = reject
    }
    req.onerror = reject
  })
}

async function loadFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('data')
    }
    req.onsuccess = e => {
      const idb = e.target.result
      const tx = idb.transaction('data', 'readonly')
      const getReq = tx.objectStore('data').get(DB_KEY)
      getReq.onsuccess = () => { idb.close(); resolve(getReq.result || null) }
      getReq.onerror = reject
    }
    req.onerror = reject
  })
}

// ── API pública de base de datos ────────────────────────────────

export function query(sql, params = []) {
  if (!db) throw new Error('DB no inicializada')
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function run(sql, params = []) {
  if (!db) throw new Error('DB no inicializada')
  db.run(sql, params)
  // Capturar last_insert_rowid y rowsModified ANTES de saveToIndexedDB,
  // porque db.export() dentro de save resetea last_insert_rowid a 0
  const rowsModified = db.getRowsModified()
  const stmt = db.prepare('SELECT last_insert_rowid() as id')
  stmt.step()
  db._lastInsertId = stmt.getAsObject().id
  stmt.free()
  saveToIndexedDB()
  return rowsModified
}

export function getLastInsertId() {
  if (db && db._lastInsertId !== undefined) return db._lastInsertId
  const res = query('SELECT last_insert_rowid() as id')
  return res[0]?.id
}

export function resetDatabase() {
  indexedDB.deleteDatabase(DB_NAME)
  db = null
}

export function getDb() { return db }
