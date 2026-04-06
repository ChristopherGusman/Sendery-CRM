import React, { useState, useEffect } from 'react'
import { query, run } from '../../db/database.js'
import { formatMXN, formatDate, today } from '../../utils/format.js'
import {
  PageHeader, PageContent, Card, Btn, Badge, Table, TR, TD,
  Modal, FormField, Input, Select, Textarea, SearchBar
} from '../../components/Layout.jsx'
import { Plus, Trash2, Filter } from 'lucide-react'

const CATEGORIAS = ['transporte','alimentación','hospedaje','equipo','marketing','otro']
const CAT_COLORS = {
  transporte: { bg: '#E8F4FD', color: '#1565C0' },
  alimentación: { bg: '#FFF3E0', color: '#E65100' },
  hospedaje: { bg: '#F3E5F5', color: '#6A1B9A' },
  equipo: { bg: '#E8F5E9', color: '#1B5E20' },
  marketing: { bg: '#FCE4EC', color: '#880E4F' },
  otro: { bg: '#F5F5F5', color: '#424242' }
}

const EMPTY = {
  fecha: today(), concepto: '', categoria: 'transporte', importe: '',
  moneda: 'MXN', ubicacion: '', evento_id: '', proveedor_id: '',
  cuenta_bancaria_id: '', comprobante: ''
}

export default function Gastos() {
  const [gastos, setGastos] = useState([])
  const [filtro, setFiltro] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [eventoFiltro, setEventoFiltro] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [eventos, setEventos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [cuentas, setCuentas] = useState([])

  useEffect(() => {
    loadGastos()
    setEventos(query(`SELECT id, nombre FROM eventos ORDER BY fecha DESC`))
    setProveedores(query(`SELECT id, nombre FROM proveedores ORDER BY nombre`))
    setCuentas(query(`SELECT * FROM cuentas_bancarias ORDER BY banco`))
  }, [])

  function loadGastos() {
    const rows = query(`
      SELECT g.*, e.nombre as evento_nombre, pr.nombre as proveedor_nombre,
        cb.banco, cb.ultimos_4
      FROM gastos g
      LEFT JOIN eventos e ON e.id = g.evento_id
      LEFT JOIN proveedores pr ON pr.id = g.proveedor_id
      LEFT JOIN cuentas_bancarias cb ON cb.id = g.cuenta_bancaria_id
      ORDER BY g.fecha DESC, g.id DESC
    `)
    setGastos(rows)
  }

  const filtered = gastos.filter(g => {
    const matchText = !filtro ||
      g.concepto.toLowerCase().includes(filtro.toLowerCase()) ||
      (g.proveedor_nombre||'').toLowerCase().includes(filtro.toLowerCase()) ||
      (g.evento_nombre||'').toLowerCase().includes(filtro.toLowerCase())
    const matchCat = !catFiltro || g.categoria === catFiltro
    const matchEv = !eventoFiltro || String(g.evento_id) === eventoFiltro || (eventoFiltro === 'general' && !g.evento_id)
    return matchText && matchCat && matchEv
  })

  const totalFiltrado = filtered.reduce((s, g) => s + Number(g.importe), 0)

  function openNew() { setForm(EMPTY); setEditando(null); setErrors({}); setModal(true) }
  function openEdit(g) {
    setForm({
      fecha: g.fecha, concepto: g.concepto, categoria: g.categoria,
      importe: g.importe, moneda: g.moneda, ubicacion: g.ubicacion||'',
      evento_id: g.evento_id||'', proveedor_id: g.proveedor_id||'',
      cuenta_bancaria_id: g.cuenta_bancaria_id||'', comprobante: g.comprobante||''
    })
    setEditando(g.id); setErrors({}); setModal(true)
  }

  function validate() {
    const e = {}
    if (!form.fecha) e.fecha = 'Fecha requerida'
    if (!form.concepto.trim()) e.concepto = 'Concepto requerido'
    if (!form.importe || Number(form.importe) <= 0) e.importe = 'Importe inválido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) return
    if (editando) {
      run(`UPDATE gastos SET fecha=?, concepto=?, categoria=?, importe=?, moneda=?,
        ubicacion=?, evento_id=?, proveedor_id=?, cuenta_bancaria_id=?, comprobante=? WHERE id=?`, [
        form.fecha, form.concepto, form.categoria, Number(form.importe), form.moneda,
        form.ubicacion, form.evento_id||null, form.proveedor_id||null,
        form.cuenta_bancaria_id||null, form.comprobante, editando
      ])
    } else {
      run(`INSERT INTO gastos (fecha, concepto, categoria, importe, moneda, ubicacion,
        evento_id, proveedor_id, cuenta_bancaria_id, comprobante) VALUES (?,?,?,?,?,?,?,?,?,?)`, [
        form.fecha, form.concepto, form.categoria, Number(form.importe), form.moneda,
        form.ubicacion, form.evento_id||null, form.proveedor_id||null,
        form.cuenta_bancaria_id||null, form.comprobante
      ])
      // Afectar saldo bancario
      if (form.cuenta_bancaria_id) {
        run(`UPDATE cuentas_bancarias SET saldo_actual = saldo_actual - ? WHERE id=?`,
          [Number(form.importe), form.cuenta_bancaria_id])
        run(`INSERT INTO movimientos (cuenta_id, fecha, tipo, concepto, importe, evento_id) VALUES (?,?,?,?,?,?)`,
          [form.cuenta_bancaria_id, form.fecha, 'egreso', form.concepto, Number(form.importe), form.evento_id||null])
      }
    }
    setModal(false); loadGastos()
  }

  function deleteGasto(g) {
    if (!confirm('¿Eliminar este gasto?')) return
    run(`DELETE FROM gastos WHERE id=?`, [g.id])
    loadGastos()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Resumen por categoría
  const resCat = CATEGORIAS.map(cat => ({
    cat,
    total: gastos.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.importe), 0)
  })).filter(r => r.total > 0)

  return (
    <div style={{ flex: 1 }}>
      <PageHeader
        title="Gastos"
        subtitle="Control de egresos y comprobantes"
        actions={<Btn icon={<Plus size={15}/>} onClick={openNew}>Registrar Gasto</Btn>}
      />
      <PageContent>
        {/* Resumen tarjetas */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{
            background: '#fff', borderRadius: 10, padding: '12px 18px',
            border: '1px solid rgba(196,169,125,0.2)', minWidth: 160
          }}>
            <div style={{ fontSize: 11, color: '#6B7B4F', fontFamily: 'DM Sans', marginBottom: 4 }}>Total gastos</div>
            <div style={{ fontFamily: 'Oswald', fontSize: 22, fontWeight: 700, color: '#8B1A1A' }}>
              {formatMXN(gastos.reduce((s, g) => s + Number(g.importe), 0))}
            </div>
          </div>
          {resCat.map(({ cat, total }) => {
            const c = CAT_COLORS[cat] || CAT_COLORS.otro
            return (
              <div key={cat} style={{
                background: c.bg, borderRadius: 10, padding: '10px 14px',
                border: `1px solid ${c.color}22`, cursor: 'pointer',
                transition: 'transform 0.1s'
              }}
                onClick={() => setCatFiltro(catFiltro === cat ? '' : cat)}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={e => e.currentTarget.style.transform = ''}
              >
                <div style={{ fontSize: 10, color: c.color, fontFamily: 'DM Sans', fontWeight: 600, textTransform: 'capitalize', marginBottom: 2 }}>{cat}</div>
                <div style={{ fontFamily: 'Oswald', fontSize: 16, fontWeight: 700, color: c.color }}>{formatMXN(total)}</div>
              </div>
            )
          })}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <SearchBar value={filtro} onChange={setFiltro} placeholder="Buscar concepto, proveedor..." style={{ flex: 1, minWidth: 200 }} />
          <Select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{ width: 160 }}>
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={eventoFiltro} onChange={e => setEventoFiltro(e.target.value)} style={{ width: 200 }}>
            <option value="">Todos los eventos</option>
            <option value="general">Gastos generales</option>
            {eventos.map(e => <option key={e.id} value={String(e.id)}>{e.nombre}</option>)}
          </Select>
        </div>

        <Card>
          <div style={{ padding: '10px 14px', background: '#F5F0E8', borderBottom: '1px solid rgba(196,169,125,0.15)', fontFamily: 'DM Sans', fontSize: 12, color: '#6B7B4F', display: 'flex', justifyContent: 'space-between' }}>
            <span>{filtered.length} registro(s)</span>
            <span style={{ fontWeight: 700, color: '#8B1A1A' }}>Subtotal: {formatMXN(totalFiltrado)}</span>
          </div>
          <Table headers={['Fecha', 'Concepto', 'Categoría', 'Evento', 'Proveedor', 'Cuenta', 'Importe', '']}>
            {filtered.length === 0 ? (
              <TR><TD style={{ textAlign: 'center', color: '#6B7B4F' }} colSpan={8}>Sin registros</TD></TR>
            ) : filtered.map(g => {
              const c = CAT_COLORS[g.categoria] || CAT_COLORS.otro
              return (
                <TR key={g.id}>
                  <TD style={{ color: '#6B7B4F', fontSize: 12 }}>{formatDate(g.fecha)}</TD>
                  <TD style={{ fontWeight: 500 }}>{g.concepto}</TD>
                  <TD><Badge label={g.categoria} bg={c.bg} color={c.color} /></TD>
                  <TD style={{ fontSize: 12, color: '#6B7B4F' }}>{g.evento_nombre || <span style={{ color: '#C4A97D' }}>General</span>}</TD>
                  <TD style={{ fontSize: 12, color: '#6B7B4F' }}>{g.proveedor_nombre || '—'}</TD>
                  <TD style={{ fontSize: 12, color: '#6B7B4F' }}>
                    {g.banco ? `${g.banco} ···${g.ultimos_4}` : '—'}
                  </TD>
                  <TD style={{ fontWeight: 700, color: '#8B1A1A' }}>{formatMXN(g.importe)}</TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(g)}
                        style={{ background: 'none', border: '1px solid rgba(196,169,125,0.4)', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                      <button onClick={() => deleteGasto(g)}
                        style={{ background: 'none', border: '1px solid #f5c6c6', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', color: '#8B1A1A' }}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </TD>
                </TR>
              )
            })}
          </Table>
        </Card>
      </PageContent>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Gasto' : 'Registrar Gasto'} width={560}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Fecha" required error={errors.fecha}>
            <Input type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)} />
          </FormField>
          <FormField label="Categoría" required>
            <Select value={form.categoria} onChange={e => f('categoria', e.target.value)}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FormField>
          <FormField label="Concepto" required error={errors.concepto} style={{ gridColumn: '1/-1' }}>
            <Input value={form.concepto} onChange={e => f('concepto', e.target.value)} placeholder="Descripción del gasto..." />
          </FormField>
          <FormField label="Importe (MXN)" required error={errors.importe}>
            <Input type="number" min="0.01" step="0.01" value={form.importe} onChange={e => f('importe', e.target.value)} />
          </FormField>
          <FormField label="Ubicación">
            <Input value={form.ubicacion} onChange={e => f('ubicacion', e.target.value)} placeholder="Ensenada, BC" />
          </FormField>
          <FormField label="Evento asociado">
            <Select value={form.evento_id} onChange={e => f('evento_id', e.target.value)}>
              <option value="">— Gasto general —</option>
              {eventos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </Select>
          </FormField>
          <FormField label="Proveedor">
            <Select value={form.proveedor_id} onChange={e => f('proveedor_id', e.target.value)}>
              <option value="">— Sin proveedor —</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Select>
          </FormField>
          <FormField label="Cuenta bancaria origen">
            <Select value={form.cuenta_bancaria_id} onChange={e => f('cuenta_bancaria_id', e.target.value)}>
              <option value="">— Sin cuenta —</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.banco} ···{c.ultimos_4}</option>)}
            </Select>
          </FormField>
          <FormField label="Comprobante / Referencia" style={{ gridColumn: '1/-1' }}>
            <Input value={form.comprobante} onChange={e => f('comprobante', e.target.value)} placeholder="Número de factura, ticket, referencia..." />
          </FormField>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="outline" onClick={() => setModal(false)}>Cancelar</Btn>
          <Btn onClick={handleSave}>{editando ? 'Guardar' : 'Registrar'}</Btn>
        </div>
      </Modal>
    </div>
  )
}
