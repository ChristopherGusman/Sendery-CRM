import React, { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { query, run, getLastInsertId } from '../../db/database.js'
import { formatMXN, formatDate, today } from '../../utils/format.js'
import {
  PageHeader, PageContent, Card, Btn, Badge, Table, TR, TD, FormField, Select
} from '../../components/Layout.jsx'
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  ArrowRight, RotateCcw, Info, ChevronDown, ChevronUp,
  Trash2, Database, ShieldAlert
} from 'lucide-react'

// ── Constantes ──────────────────────────────────────────────────
const SHEET_NAME = 'SENDERY_IMPORTAR' // fallback: primera hoja

// Mapeo de nombres de cuenta Excel → datos para cuentas_bancarias
const BANK_PRESETS = {
  'BANCOMER NINEL':   { banco: 'Bancomer', titular: 'Ninel (Sendery)', tipo: 'cheques', ultimos_4: 'NIL1' },
  'BANCOMER OCTAVIO': { banco: 'Bancomer', titular: 'Octavio (Sendery)', tipo: 'cheques', ultimos_4: 'OCT2' },
  'BANCO AZTECA':     { banco: 'Banco Azteca', titular: 'Sendery Outdoor', tipo: 'cheques', ultimos_4: 'AZT3' },
  'EFECTIVO':         { banco: 'Efectivo', titular: 'Caja General', tipo: 'efectivo', ultimos_4: 'EFE1' },
  'EFECTIVO OCTAVIO': { banco: 'Efectivo', titular: 'Octavio (Sendery)', tipo: 'efectivo', ultimos_4: 'EFE2' },
  'STP':              { banco: 'STP', titular: 'Sendery Outdoor', tipo: 'ahorro', ultimos_4: 'STP1' },
  'SPIN':             { banco: 'SPIN by OXXO', titular: 'Sendery Outdoor', tipo: 'ahorro', ultimos_4: 'SPN1' },
}

// ── Utilidades de fecha ─────────────────────────────────────────
function parseExcelDate(val) {
  if (!val && val !== 0) return today()
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(val)
      if (date) return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`
    } catch {}
  }
  if (typeof val === 'string') {
    const s = val.trim()
    // DD/MM/YYYY
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
    // YYYY-MM-DD
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m2) return m2[0]
    // DD-MM-YYYY
    const m3 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
    if (m3) return `${m3[3]}-${m3[2].padStart(2,'0')}-${m3[1].padStart(2,'0')}`
    // Fallback
    const d = new Date(s)
    if (!isNaN(d)) return d.toISOString().split('T')[0]
  }
  return today()
}

// Normalizar fila: trim en claves y valores string
function normalizeRow(row) {
  const clean = {}
  for (const [k, v] of Object.entries(row)) {
    const key = k.trim()
    clean[key] = typeof v === 'string' ? v.trim() : v
  }
  return clean
}

// Parsear monto — puede tener $, comas, espacios, negativos
function parseMonto(val) {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const s = String(val).replace(/[$,\s]/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

// ── Inicializar tabla de seguimiento ────────────────────────────
function initImportLog() {
  run(`CREATE TABLE IF NOT EXISTS excel_imports_log (
    folio     TEXT PRIMARY KEY,
    tipo      TEXT,
    evento_id INTEGER,
    fecha_import TEXT DEFAULT (datetime('now','localtime'))
  )`)
}

// ── Lookup helpers ──────────────────────────────────────────────
const _cache = {
  cuentas: {},   // nombre_excel → cuenta_id
  clientes: {},  // nombre → cliente_id
  eventos: {},   // cev → evento_id
  partic: {}     // `${cliente_id}_${evento_id}` → participante_id
}

function resetCache() {
  _cache.cuentas = {}
  _cache.clientes = {}
  _cache.eventos = {}
  _cache.partic = {}
}

function findOrCreateCuenta(nombreExcel) {
  const key = (nombreExcel || 'EFECTIVO').toUpperCase().trim()
  if (_cache.cuentas[key] !== undefined) return _cache.cuentas[key]

  // Buscar en DB por titular o banco que contenga el nombre
  const preset = BANK_PRESETS[key]
  if (preset) {
    const ex = query(`SELECT id FROM cuentas_bancarias WHERE titular=? LIMIT 1`, [preset.titular])
    if (ex.length) { _cache.cuentas[key] = ex[0].id; return ex[0].id }
    // Crear
    run(`INSERT INTO cuentas_bancarias (banco, ultimos_4, titular, tipo, saldo_actual) VALUES (?,?,?,?,0)`,
      [preset.banco, preset.ultimos_4, preset.titular, preset.tipo])
    const id = getLastInsertId()
    _cache.cuentas[key] = id
    return id
  }
  // Cuenta desconocida → miscelánea
  const ex2 = query(`SELECT id FROM cuentas_bancarias WHERE banco=? LIMIT 1`, [key])
  if (ex2.length) { _cache.cuentas[key] = ex2[0].id; return ex2[0].id }
  run(`INSERT INTO cuentas_bancarias (banco, ultimos_4, titular, tipo, saldo_actual) VALUES (?,?,?,?,0)`,
    [key, 'IMP1', 'Importado', 'cheques'])
  const id2 = getLastInsertId()
  _cache.cuentas[key] = id2
  return id2
}

function findOrCreateCliente(nombre) {
  const key = nombre.toLowerCase().trim()
  if (_cache.clientes[key] !== undefined) return _cache.clientes[key]
  const ex = query(`SELECT id FROM clientes WHERE LOWER(nombre)=? LIMIT 1`, [key])
  if (ex.length) { _cache.clientes[key] = ex[0].id; return ex[0].id }
  run(`INSERT INTO clientes (nombre, ciudad, fecha_registro) VALUES (?,?,?)`,
    [nombre.trim(), 'Ensenada', today()])
  const id = getLastInsertId()
  _cache.clientes[key] = id
  return id
}

function findOrCreateEvento(cev, nombre, fechaEvento) {
  const key = String(cev).trim()
  if (_cache.eventos[key] !== undefined) return _cache.eventos[key]
  const ex = query(`SELECT id FROM eventos WHERE nombre=? LIMIT 1`, [nombre.trim()])
  if (ex.length) { _cache.eventos[key] = ex[0].id; return ex[0].id }
  // Determinar tipo por CEV o nombre
  const tipo = (nombre.toLowerCase().includes('vuelo') ||
    nombre.toLowerCase().includes('viaje') ||
    nombre.toLowerCase().includes('tour'))
    ? 'viaje' : 'caminata'
  // fechaEvento puede ser texto descriptivo ("DEL 19 AL 26 FEBRERO") — guardar como está
  const fechaStr = String(fechaEvento || '').trim()
  const fechaDB = fechaStr || parseExcelDate(fechaEvento)
  run(`INSERT INTO eventos (nombre, tipo, fecha, lugar, ejecutor, costo_total, cupo_maximo, estado) VALUES (?,?,?,?,?,0,0,'cerrado')`,
    [nombre.trim(), tipo, fechaDB, 'Importado de Excel', 'Importación histórica'])
  const id = getLastInsertId()
  _cache.eventos[key] = id
  return id
}

function findOrCreateParticipante(clienteId, clienteNombre, eventoId, monto) {
  const key = `${clienteId}_${eventoId}`
  if (_cache.partic[key] !== undefined) return _cache.partic[key]
  const ex = query(`SELECT id FROM participantes WHERE cliente_id=? AND evento_id=? LIMIT 1`,
    [clienteId, eventoId])
  if (ex.length) { _cache.partic[key] = ex[0].id; return ex[0].id }
  run(`INSERT INTO participantes (evento_id, cliente_id, nombre_cliente, monto_total_acordado, saldo_pendiente) VALUES (?,?,?,0,0)`,
    [eventoId, clienteId, clienteNombre.trim()])
  const id = getLastInsertId()
  _cache.partic[key] = id
  return id
}

// ── Componente principal ────────────────────────────────────────
export default function Importador() {
  const fileInputRef = useRef(null)
  const [step, setStep] = useState('idle') // idle | parsed | confirmando | importing | done | error
  const [fileName, setFileName] = useState('')
  const [allRows, setAllRows] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' })
  const [results, setResults] = useState(null)
  const [importErrors, setImportErrors] = useState([])
  const [showPreviewFull, setShowPreviewFull] = useState(false)
  const [cleanMsg, setCleanMsg] = useState(null) // { type: 'ok'|'err', text: string }

  // ── Limpiar SOLO la tabla de control de importaciones ──────
  const limpiarHistorialImport = () => {
    if (!confirm(
      '¿Borrar el historial de importación?\n\n' +
      'Esto eliminará únicamente la tabla excel_imports_log.\n' +
      'Los clientes, eventos, abonos y demás datos NO se tocarán.\n\n' +
      'Después podrás volver a importar el archivo Excel desde cero.'
    )) return
    try {
      initImportLog() // crear si no existe
      run(`DELETE FROM excel_imports_log`)
      const n = query(`SELECT changes() as c`)[0]?.c ?? '?'
      setCleanMsg({ type: 'ok', text: `Historial limpiado — ${n} registros eliminados de excel_imports_log. Ahora puedes reimportar el Excel.` })
    } catch (err) {
      setCleanMsg({ type: 'err', text: `Error: ${err.message}` })
    }
  }

  // ── Limpiar datos de muestra (seed) ────────────────────────
  const limpiarDatosMuestra = () => {
    if (!confirm(
      '⚠️ ATENCIÓN — Esta acción es irreversible.\n\n' +
      'Se borrarán TODOS los datos de:\n' +
      '  • Abonos\n  • Participantes\n  • Eventos\n  • Clientes\n' +
      '  • Gastos\n  • Movimientos bancarios\n  • Pagos a proveedores\n\n' +
      'Los saldos de cuentas bancarias se resetearán a $0.\n' +
      'Los proveedores y las cuentas bancarias se conservan.\n\n' +
      '¿Continuar?'
    )) return
    try {
      run(`DELETE FROM abonos`)
      run(`DELETE FROM participantes`)
      run(`DELETE FROM gastos`)
      run(`DELETE FROM movimientos`)
      run(`DELETE FROM pagos_proveedores`)
      run(`DELETE FROM eventos`)
      run(`DELETE FROM clientes`)
      run(`UPDATE cuentas_bancarias SET saldo_actual = 0`)
      // Limpiar también el log para que la próxima importación arranque limpia
      initImportLog()
      run(`DELETE FROM excel_imports_log`)
      setCleanMsg({ type: 'ok', text: 'Datos de muestra eliminados. Clientes, eventos, abonos, gastos y movimientos borrados. Saldos de cuentas reseteados a $0. Sistema listo para importar datos reales.' })
    } catch (err) {
      setCleanMsg({ type: 'err', text: `Error al limpiar: ${err.message}` })
    }
  }

  // ── Parsear archivo ─────────────────────────────────────────
  const parseFile = useCallback((file) => {
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })

        // Buscar la hoja
        let sheetName = wb.SheetNames.find(n => n.trim() === SHEET_NAME)
        if (!sheetName) sheetName = wb.SheetNames[0]

        const ws = wb.Sheets[sheetName]
        const raw = XLSX.utils.sheet_to_json(ws, {
          raw: true,
          defval: '',
          cellDates: true
        })

        if (raw.length === 0) {
          setStep('error')
          setImportErrors(['La hoja está vacía o no se encontraron datos.'])
          return
        }

        const normalized = raw.map(normalizeRow)
        // Detectar columnas reales
        const cols = Object.keys(normalized[0] || {})
        setHeaders(cols)
        setAllRows(normalized)
        setPreviewRows(normalized.slice(0, 10))
        setStep('parsed')
      } catch (err) {
        setStep('error')
        setImportErrors([`Error al leer el archivo: ${err.message}`])
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const onFileChange = (e) => { const f = e.target.files[0]; if (f) parseFile(f) }
  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) parseFile(f)
  }

  // ── Ejecutar importación ────────────────────────────────────
  const runImport = async () => {
    setStep('importing')
    initImportLog()
    // Limpiar log previo para evitar duplicados de intentos anteriores
    run(`DELETE FROM excel_imports_log`)
    resetCache()

    const stats = { clientes: 0, eventos: 0, abonos: 0, gastos: 0, omitidos: 0 }
    const errors = []
    const tiposDesconocidos = new Set() // para diagnóstico
    const total = allRows.length

    // Precargar cache de clientes y eventos existentes
    query(`SELECT id, LOWER(nombre) as n FROM clientes`).forEach(r => { _cache.clientes[r.n] = r.id })
    // Precargar eventos por nombre Y por nombre normalizado
    query(`SELECT id, nombre FROM eventos`).forEach(r => {
      _cache.eventos[r.nombre] = r.id
      _cache.eventos[r.nombre.trim()] = r.id
    })

    // Rastrear cuántos clientes/eventos había antes
    const clientesAntes = query(`SELECT COUNT(*) as c FROM clientes`)[0]?.c || 0
    const eventosAntes  = query(`SELECT COUNT(*) as c FROM eventos`)[0]?.c || 0

    const CHUNK = 30 // procesar en lotes para no bloquear UI
    for (let i = 0; i < allRows.length; i++) {
      if (i % CHUNK === 0) {
        setProgress({ current: i, total, phase: `Procesando registros...` })
        await new Promise(r => setTimeout(r, 0)) // yield al navegador
      }

      const row = allRows[i]
      try {
        const folio   = String(row['FOLIO'] ?? '').trim()
        const fecha   = parseExcelDate(row['FECHA_ABONO'])
        const nombre  = String(row['NOMBRE_CLIENTE'] ?? '').trim()
        const cev     = String(row['CODIGO_EVENTO'] ?? '').trim()
        const evento  = String(row['NOMBRE_EVENTO'] ?? '').trim()
        const fEvento = String(row['FECHA_EVENTO'] ?? '').trim()
        const monto   = parseMonto(row['MONTO'])
        const cuenta  = String(row['CUENTA_BANCO'] ?? '').trim().toUpperCase()
        const tipoRaw = String(row['TIPO'] ?? '').trim().toUpperCase()

        // Normalizar TIPO — acepta variantes y cae en signo del monto si no reconoce
        let tipo
        if (['ABONO','A','PAGO','P','COBRO','INGRESO','IN'].includes(tipoRaw)) {
          tipo = 'ABONO'
        } else if (['GASTO','G','EGRESO','E','SALIDA','S','DEVOLUCION','DEV'].includes(tipoRaw)) {
          tipo = 'GASTO'
        } else if (tipoRaw === '' || tipoRaw === '-' || tipoRaw === 'N/A') {
          tipo = monto > 0 ? 'ABONO' : monto < 0 ? 'GASTO' : ''
        } else {
          tiposDesconocidos.add(tipoRaw)
          tipo = monto > 0 ? 'ABONO' : monto < 0 ? 'GASTO' : ''
        }

        // Skip filas vacías o sin datos clave
        if (!folio) { stats.omitidos++; continue }
        if (!evento && !nombre) { stats.omitidos++; continue }
        if (!tipo) { stats.omitidos++; continue }

        // Verificar si ya fue importado en esta sesión
        const yaExiste = query(`SELECT folio FROM excel_imports_log WHERE folio=? LIMIT 1`, [folio])
        if (yaExiste.length) { stats.omitidos++; continue }

        const cuentaId = findOrCreateCuenta(cuenta)
        const eventoId = evento ? findOrCreateEvento(cev, evento, fEvento) : null

        if (tipo === 'ABONO' && nombre && eventoId) {
          // ── ABONO ─────────────────────────────────────────
          const montoAbs = Math.abs(monto)
          const clienteId = findOrCreateCliente(nombre)
          const partId    = findOrCreateParticipante(clienteId, nombre, eventoId, montoAbs)

          // Insertar abono
          run(`INSERT INTO abonos (participante_id, evento_id, cliente_id, fecha, monto, referencia, cuenta_destino)
               VALUES (?,?,?,?,?,?,?)`,
            [partId, eventoId, clienteId, fecha, montoAbs, folio, cuenta])

          // Actualizar monto_total_acordado y fecha_ultimo_pago del participante
          run(`UPDATE participantes SET
               monto_total_acordado = monto_total_acordado + ?,
               fecha_ultimo_pago = ?
               WHERE id = ?`,
            [montoAbs, fecha, partId])

          // Movimiento bancario
          run(`INSERT OR IGNORE INTO movimientos (cuenta_id, fecha, tipo, concepto, importe, referencia, evento_id)
               VALUES (?,?,?,?,?,?,?)`,
            [cuentaId, fecha, 'ingreso',
             `${nombre} — ${evento}`.slice(0,100),
             montoAbs, folio, eventoId])

          // Actualizar saldo cuenta
          run(`UPDATE cuentas_bancarias SET saldo_actual = saldo_actual + ? WHERE id=?`, [montoAbs, cuentaId])

          stats.abonos++

        } else if (tipo === 'GASTO' && eventoId) {
          // ── GASTO — NOMBRE_CLIENTE se usa como concepto ───
          const importe = Math.abs(monto)
          run(`INSERT INTO gastos (fecha, concepto, categoria, importe, moneda, evento_id, cuenta_bancaria_id, comprobante)
               VALUES (?,?,?,?,?,?,?,?)`,
            [fecha,
             (nombre || `Gasto ${cev}`).slice(0, 120),
             'otro',
             importe, 'MXN',
             eventoId, cuentaId, folio])

          run(`INSERT OR IGNORE INTO movimientos (cuenta_id, fecha, tipo, concepto, importe, referencia, evento_id)
               VALUES (?,?,?,?,?,?,?)`,
            [cuentaId, fecha, 'egreso',
             (nombre || `Gasto ${cev}`).slice(0,100),
             importe, folio, eventoId])

          run(`UPDATE cuentas_bancarias SET saldo_actual = saldo_actual - ? WHERE id=?`, [importe, cuentaId])

          stats.gastos++

        } else {
          stats.omitidos++
          continue
        }

        // Marcar folio como importado en esta sesión
        run(`INSERT OR IGNORE INTO excel_imports_log (folio, tipo, evento_id) VALUES (?,?,?)`,
          [folio, tipo.toLowerCase(), eventoId])

      } catch (err) {
        errors.push(`Fila ${i + 2}: ${err.message}`)
        if (errors.length > 20) { errors.push('(Se omiten errores adicionales...)'); break }
      }
    }

    // Contar reales: clientes y eventos nuevos
    const clientesDespues = query(`SELECT COUNT(*) as c FROM clientes`)[0]?.c || 0
    const eventosDespues  = query(`SELECT COUNT(*) as c FROM eventos`)[0]?.c || 0
    stats.clientes = clientesDespues - clientesAntes
    stats.eventos  = eventosDespues  - eventosAntes

    // Diagnóstico de TIPO no reconocidos
    if (tiposDesconocidos.size > 0) {
      errors.unshift(`⚠️ Valores de columna TIPO no reconocidos (se infirió por signo del monto): ${[...tiposDesconocidos].join(', ')}`)
    }

    setProgress({ current: total, total, phase: 'Finalizando...' })
    await new Promise(r => setTimeout(r, 300))
    setResults(stats)
    setImportErrors(errors)
    setStep('done')
  }

  const reset = () => {
    setStep('idle')
    setFileName('')
    setAllRows([])
    setPreviewRows([])
    setHeaders([])
    setResults(null)
    setImportErrors([])
    setProgress({ current: 0, total: 0, phase: '' })
    setShowPreviewFull(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Columnas para preview ───────────────────────────────────
  const COL_MAP = {
    'FOLIO': 'Folio', 'FECHA_ABONO': 'Fecha abono', 'NOMBRE_CLIENTE': 'Nombre / Concepto',
    'CODIGO_EVENTO': 'Código', 'NOMBRE_EVENTO': 'Evento', 'FECHA_EVENTO': 'Fecha evento',
    'MONTO': 'Monto', 'CUENTA_BANCO': 'Cuenta', 'TIPO': 'Tipo'
  }
  const previewCols = ['FOLIO','FECHA_ABONO','NOMBRE_CLIENTE','CODIGO_EVENTO','NOMBRE_EVENTO','FECHA_EVENTO','MONTO','CUENTA_BANCO','TIPO']
    .filter(c => headers.includes(c))

  const getCell = (row, col) =>
    row[col] !== undefined ? row[col] : row[col + ' '] !== undefined ? row[col + ' '] : ''

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  // ── Estadísticas rápidas del archivo ───────────────────────
  const statsArchivo = allRows.length > 0 ? (() => {
    const positivos = allRows.filter(r => String(r['TIPO']||'').trim().toUpperCase() === 'ABONO').length
    const negativos = allRows.filter(r => String(r['TIPO']||'').trim().toUpperCase() === 'GASTO').length
    const cuentasUnicas = [...new Set(allRows.map(r => String(r['CUENTA_BANCO'] ?? '').trim().toUpperCase()).filter(Boolean))]
    const eventosUnicos = [...new Set(allRows.map(r => String(r['NOMBRE_EVENTO'] ?? '').trim()).filter(Boolean))].length
    const clientesUnicos = [...new Set(
      allRows.filter(r => String(r['TIPO']||'').trim().toUpperCase() === 'ABONO')
             .map(r => String(r['NOMBRE_CLIENTE'] ?? '').trim().toLowerCase())
             .filter(Boolean)
    )].length
    return { positivos, negativos, cuentasUnicas, eventosUnicos, clientesUnicos }
  })() : null

  return (
    <div style={{ flex: 1 }}>
      <PageHeader
        title="Importar Excel"
        subtitle="Carga masiva de datos históricos — SENDERY_IMPORTAR.xlsx"
        actions={step !== 'idle' && step !== 'importing' && (
          <Btn variant="outline" size="sm" icon={<RotateCcw size={13}/>} onClick={reset}>
            Nueva importación
          </Btn>
        )}
      />
      <PageContent>

        {/* ── PASO 1: Soltar archivo ── */}
        {step === 'idle' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#4A5E28' : 'rgba(196,169,125,0.5)'}`,
                borderRadius: 16,
                padding: '60px 40px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(74,94,40,0.05)' : '#fff',
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 72, height: 72, background: '#EAF0D8', borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <FileSpreadsheet size={36} color="#4A5E28" />
              </div>
              <div style={{ fontFamily: 'Oswald', fontSize: 20, color: '#2C3A1A', marginBottom: 8, letterSpacing: 0.5 }}>
                SOLTAR ARCHIVO AQUÍ
              </div>
              <div style={{ fontFamily: 'DM Sans', fontSize: 14, color: '#6B7B4F', marginBottom: 20 }}>
                o haz clic para seleccionar el archivo
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#E8C547', color: '#2C3A1A', fontFamily: 'DM Sans',
                fontWeight: 700, fontSize: 13, padding: '10px 22px', borderRadius: 8
              }}>
                <Upload size={15}/> Seleccionar .xlsx
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: '#C4A97D', fontFamily: 'DM Sans' }}>
                Columnas requeridas: <strong>FOLIO, FECHA_ABONO, NOMBRE_CLIENTE, NOMBRE_EVENTO, MONTO, CUENTA_BANCO, TIPO</strong> · Formato: .xlsx / .xls
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={onFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Leyenda de mapeo de cuentas */}
            <Card title="Cuentas que se mapearán automáticamente" style={{ marginTop: 20 }}>
              <div style={{ padding: '12px 20px' }}>
                {Object.entries(BANK_PRESETS).map(([nombre, datos]) => (
                  <div key={nombre} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 0', borderBottom: '1px solid rgba(196,169,125,0.12)',
                    fontFamily: 'DM Sans', fontSize: 13
                  }}>
                    <span style={{ fontWeight: 600, color: '#2C3A1A', fontFamily: 'monospace', fontSize: 12 }}>
                      {nombre}
                    </span>
                    <span style={{ color: '#6B7B4F', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowRight size={12} color="#C4A97D"/>
                      {datos.banco} · {datos.titular} ({datos.tipo})
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: 10, fontSize: 12, color: '#6B7B4F', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Info size={12}/>
                  Las cuentas no existentes en el sistema se crearán automáticamente
                </div>
              </div>
            </Card>

            {/* ── Herramientas de mantenimiento ── */}
            <Card title="Herramientas de mantenimiento" style={{ marginTop: 20 }}>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Mensaje de resultado */}
                {cleanMsg && (
                  <div style={{
                    background: cleanMsg.type === 'ok' ? '#EAF0D8' : '#FCECEA',
                    color: cleanMsg.type === 'ok' ? '#2C3A1A' : '#8B1A1A',
                    borderRadius: 8, padding: '10px 14px',
                    fontFamily: 'DM Sans', fontSize: 13,
                    display: 'flex', alignItems: 'flex-start', gap: 8
                  }}>
                    {cleanMsg.type === 'ok'
                      ? <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }}/>
                      : <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }}/>}
                    {cleanMsg.text}
                  </div>
                )}

                {/* Opción 1: Solo historial */}
                <div style={{
                  border: '1px solid rgba(196,169,125,0.3)', borderRadius: 10, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <Database size={20} color="#4A5E28" style={{ flexShrink: 0, marginTop: 2 }}/>
                    <div>
                      <div style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: 14, color: '#2C3A1A', marginBottom: 3 }}>
                        Limpiar historial de importación
                      </div>
                      <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: '#6B7B4F' }}>
                        Borra únicamente <code style={{ background: '#F5F0E8', padding: '1px 5px', borderRadius: 4 }}>excel_imports_log</code>.
                        No toca clientes, eventos ni abonos. Permite reimportar el mismo Excel.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={limpiarHistorialImport}
                    style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                      background: '#EAF0D8', color: '#2C3A1A', border: '1px solid rgba(44,58,26,0.3)',
                      borderRadius: 7, padding: '8px 14px', cursor: 'pointer',
                      fontFamily: 'DM Sans', fontWeight: 600, fontSize: 13
                    }}>
                    <Trash2 size={13}/> Limpiar log
                  </button>
                </div>

                {/* Opción 2: Datos de muestra */}
                <div style={{
                  border: '1px solid rgba(139,26,26,0.25)', borderRadius: 10, padding: '14px 16px',
                  background: '#FFF8F8',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <ShieldAlert size={20} color="#8B1A1A" style={{ flexShrink: 0, marginTop: 2 }}/>
                    <div>
                      <div style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: 14, color: '#8B1A1A', marginBottom: 3 }}>
                        Limpiar datos de muestra
                      </div>
                      <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: '#6B7B4F' }}>
                        Elimina <strong>todos</strong> los clientes, eventos, participantes, abonos, gastos y movimientos.
                        Resetea saldos de cuentas a $0. <strong>Irreversible.</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={limpiarDatosMuestra}
                    style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                      background: '#FCECEA', color: '#8B1A1A', border: '1px solid rgba(139,26,26,0.35)',
                      borderRadius: 7, padding: '8px 14px', cursor: 'pointer',
                      fontFamily: 'DM Sans', fontWeight: 600, fontSize: 13
                    }}>
                    <Trash2 size={13}/> Limpiar todo
                  </button>
                </div>

              </div>
            </Card>
          </div>
        )}

        {/* ── PASO 2: Vista previa ── */}
        {step === 'parsed' && (
          <div>
            {/* Resumen del archivo */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{
                background: '#2C3A1A', borderRadius: 12, padding: '14px 20px',
                display: 'flex', alignItems: 'center', gap: 12, flex: 1
              }}>
                <FileSpreadsheet size={24} color="#E8C547"/>
                <div>
                  <div style={{ color: '#E8C547', fontFamily: 'Oswald', fontSize: 15, fontWeight: 700 }}>{fileName}</div>
                  <div style={{ color: '#C4A97D', fontFamily: 'DM Sans', fontSize: 12 }}>{allRows.length.toLocaleString()} registros totales</div>
                </div>
              </div>
              {statsArchivo && [
                { label: 'TIPO = ABONO', val: statsArchivo.positivos, color: '#2C3A1A', bg: '#EAF0D8' },
                { label: 'TIPO = GASTO', val: statsArchivo.negativos, color: '#8B1A1A', bg: '#FCECEA' },
                { label: 'Clientes únicos', val: statsArchivo.clientesUnicos, color: '#2C3A1A', bg: '#FFF3CC' },
                { label: 'Eventos únicos', val: statsArchivo.eventosUnicos, color: '#4A5E28', bg: '#EAF0D8' },
              ].map(({ label, val, color, bg }) => (
                <div key={label} style={{ background: bg, borderRadius: 12, padding: '14px 20px', minWidth: 130 }}>
                  <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: '#6B7B4F', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontFamily: 'Oswald', fontSize: 24, fontWeight: 700, color }}>{val.toLocaleString()}</div>
                </div>
              ))}
            </div>

            {/* Tabla de preview */}
            <Card
              title={`Vista previa — primeros ${Math.min(10, allRows.length)} registros`}
              style={{ marginBottom: 20 }}
              headerActions={
                <button onClick={() => setShowPreviewFull(x => !x)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A5E28', fontFamily: 'DM Sans', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {showPreviewFull ? <><ChevronUp size={14}/> Menos</> : <><ChevronDown size={14}/> Ver columnas crudas</>}
                </button>
              }
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'DM Sans', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#2C3A1A' }}>
                      {(showPreviewFull ? headers : previewCols).map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#E8C547', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                          {COL_MAP[h.trim()] || h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => {
                      const monto = parseMonto(getCell(row, 'ABONO'))
                      return (
                        <tr key={i} style={{
                          background: i % 2 === 1 ? 'rgba(245,240,232,0.5)' : '#fff',
                          borderBottom: '1px solid rgba(196,169,125,0.1)'
                        }}>
                          {(showPreviewFull ? headers : previewCols).map(h => {
                            const val = showPreviewFull ? row[h] : getCell(row, h)
                            const isMontoCol = h.trim() === 'ABONO'
                            const displayVal = val instanceof Date
                              ? val.toLocaleDateString('es-MX')
                              : String(val ?? '')
                            return (
                              <td key={h} style={{
                                padding: '7px 12px',
                                color: isMontoCol
                                  ? (monto > 0 ? '#2C3A1A' : monto < 0 ? '#8B1A1A' : '#999')
                                  : '#2C3A1A',
                                fontWeight: isMontoCol ? 700 : 400,
                                whiteSpace: 'nowrap',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {isMontoCol && val !== ''
                                  ? formatMXN(parseMonto(val))
                                  : displayVal}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Aviso de lógica */}
            <div style={{
              background: '#FFF3CC', borderRadius: 10, padding: '14px 18px',
              marginBottom: 20, fontFamily: 'DM Sans', fontSize: 13, color: '#7A5A00',
              display: 'flex', gap: 10, alignItems: 'flex-start'
            }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: 1 }}/>
              <div>
                <strong>Reglas de importación:</strong> <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 3 }}>TIPO = ABONO</code> → crea cliente, registra abono al evento. &nbsp;
                <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 3 }}>TIPO = GASTO</code> → registra gasto usando NOMBRE_CLIENTE como concepto (sin crear cliente).
                El historial de importación se limpia automáticamente al iniciar para procesar todas las filas desde cero.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Btn variant="outline" onClick={reset}>Cancelar</Btn>
              <Btn onClick={runImport} icon={<Upload size={15}/>}>
                Importar {allRows.length.toLocaleString()} registros
              </Btn>
            </div>
          </div>
        )}

        {/* ── PASO 3: Progreso ── */}
        {step === 'importing' && (
          <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, border: '5px solid #EAF0D8',
              borderTop: '5px solid #4A5E28', borderRadius: '50%',
              margin: '0 auto 28px',
              animation: 'spin 1s linear infinite'
            }}/>
            <div style={{ fontFamily: 'Oswald', fontSize: 22, color: '#2C3A1A', marginBottom: 8 }}>
              IMPORTANDO DATOS
            </div>
            <div style={{ fontFamily: 'DM Sans', fontSize: 14, color: '#6B7B4F', marginBottom: 24 }}>
              {progress.phase}
            </div>

            {/* Barra de progreso */}
            <div style={{ background: 'rgba(196,169,125,0.2)', borderRadius: 8, height: 12, marginBottom: 12, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 8,
                background: 'linear-gradient(90deg, #4A5E28, #E8C547)',
                width: `${pct}%`,
                transition: 'width 0.3s ease'
              }}/>
            </div>
            <div style={{ fontFamily: 'DM Sans', fontSize: 13, color: '#6B7B4F' }}>
              {progress.current.toLocaleString()} de {progress.total.toLocaleString()} registros ({pct}%)
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── PASO 4: Resultado ── */}
        {step === 'done' && results && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{
              background: '#2C3A1A', borderRadius: 16, padding: '32px',
              textAlign: 'center', marginBottom: 24
            }}>
              <CheckCircle2 size={48} color="#E8C547" style={{ marginBottom: 16 }}/>
              <div style={{ fontFamily: 'Oswald', fontSize: 26, color: '#E8C547', letterSpacing: 1, marginBottom: 6 }}>
                IMPORTACIÓN COMPLETADA
              </div>
              <div style={{ fontFamily: 'DM Sans', fontSize: 14, color: '#C4A97D' }}>
                {fileName}
              </div>
            </div>

            {/* Tarjetas de resumen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Clientes creados', val: results.clientes, bg: '#FFF3CC', color: '#7A5A00', icon: '👤' },
                { label: 'Eventos creados', val: results.eventos, bg: '#EAF0D8', color: '#2C3A1A', icon: '🗓️' },
                { label: 'Abonos registrados', val: results.abonos, bg: '#EAF0D8', color: '#2C3A1A', icon: '💰' },
                { label: 'Gastos registrados', val: results.gastos, bg: '#FCECEA', color: '#8B1A1A', icon: '📤' },
                { label: 'Registros omitidos', val: results.omitidos, bg: '#F5F5F5', color: '#555', icon: '⏭️' },
              ].map(({ label, val, bg, color, icon }) => (
                <div key={label} style={{
                  background: bg, borderRadius: 12, padding: '18px 20px',
                  display: 'flex', alignItems: 'center', gap: 14
                }}>
                  <div style={{ fontSize: 28 }}>{icon}</div>
                  <div>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: '#6B7B4F', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: 'Oswald', fontSize: 26, fontWeight: 700, color }}>{val.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Errores si los hay */}
            {importErrors.length > 0 && (
              <Card title={`Advertencias (${importErrors.length})`} style={{ marginBottom: 20 }}>
                <div style={{ padding: '12px 20px', maxHeight: 180, overflowY: 'auto' }}>
                  {importErrors.map((e, i) => (
                    <div key={i} style={{
                      fontFamily: 'DM Sans', fontSize: 12, color: '#8B1A1A',
                      padding: '4px 0', borderBottom: '1px solid rgba(196,169,125,0.1)',
                      display: 'flex', gap: 8
                    }}>
                      <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }}/> {e}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Btn variant="outline" onClick={reset} icon={<Upload size={14}/>}>
                Importar otro archivo
              </Btn>
              <Btn variant="secondary" onClick={() => window.location.href = '/'}>
                Ver Dashboard
              </Btn>
            </div>
          </div>
        )}

        {/* ── Error de parseo ── */}
        {step === 'error' && (
          <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
            <AlertCircle size={48} color="#8B1A1A" style={{ marginBottom: 16 }}/>
            <div style={{ fontFamily: 'Oswald', fontSize: 20, color: '#8B1A1A', marginBottom: 12 }}>
              ERROR AL LEER EL ARCHIVO
            </div>
            {importErrors.map((e, i) => (
              <div key={i} style={{ fontFamily: 'DM Sans', fontSize: 13, color: '#8B1A1A', marginBottom: 8 }}>{e}</div>
            ))}
            <Btn onClick={reset} style={{ marginTop: 16 }} variant="outline">Intentar de nuevo</Btn>
          </div>
        )}
      </PageContent>
    </div>
  )
}
