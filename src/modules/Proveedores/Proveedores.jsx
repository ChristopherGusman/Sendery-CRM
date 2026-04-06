import React, { useState, useEffect } from 'react'
import { query, run } from '../../db/database.js'
import { formatMXN, formatDate, today } from '../../utils/format.js'
import {
  PageHeader, PageContent, Card, Btn, Badge, Table, TR, TD,
  Modal, FormField, Input, Select, Textarea, SearchBar
} from '../../components/Layout.jsx'
import { Plus, Trash2, Phone, Mail, X, DollarSign } from 'lucide-react'

const EMPTY = { nombre: '', tipo_servicio: '', telefono: '', email: '', rfc: '', notas: '' }
const EMPTY_PAGO = { fecha: today(), concepto: '', importe: '', cuenta_bancaria_id: '', referencia: '' }

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [detalle, setDetalle] = useState(null)
  const [pagos, setPagos] = useState([])
  const [pagoModal, setPagoModal] = useState(false)
  const [pagoForm, setPagoForm] = useState(EMPTY_PAGO)
  const [cuentas, setCuentas] = useState([])

  useEffect(() => {
    loadProveedores()
    setCuentas(query(`SELECT * FROM cuentas_bancarias ORDER BY banco`))
  }, [])

  function loadProveedores() {
    const rows = query(`
      SELECT pr.*,
        COUNT(DISTINCT pp.id) as total_pagos,
        COALESCE(SUM(pp.importe),0) as total_pagado
      FROM proveedores pr
      LEFT JOIN pagos_proveedores pp ON pp.proveedor_id = pr.id
      GROUP BY pr.id ORDER BY pr.nombre
    `)
    setProveedores(rows)
  }

  function openDetalle(p) {
    setDetalle(p)
    const h = query(`
      SELECT pp.*, cb.banco, cb.ultimos_4
      FROM pagos_proveedores pp
      LEFT JOIN cuentas_bancarias cb ON cb.id = pp.cuenta_bancaria_id
      WHERE pp.proveedor_id = ? ORDER BY pp.fecha DESC
    `, [p.id])
    setPagos(h)
  }

  const filtered = proveedores.filter(p =>
    !filtro ||
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    p.tipo_servicio.toLowerCase().includes(filtro.toLowerCase()) ||
    (p.rfc||'').toLowerCase().includes(filtro.toLowerCase())
  )

  function openNew() { setForm(EMPTY); setEditando(null); setErrors({}); setModal(true) }
  function openEdit(p) {
    setForm({ nombre: p.nombre, tipo_servicio: p.tipo_servicio, telefono: p.telefono||'', email: p.email||'', rfc: p.rfc||'', notas: p.notas||'' })
    setEditando(p.id); setErrors({}); setModal(true)
  }

  function handleSave() {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'Nombre requerido'
    if (!form.tipo_servicio.trim()) e.tipo_servicio = 'Tipo de servicio requerido'
    setErrors(e)
    if (Object.keys(e).length) return
    if (editando) {
      run(`UPDATE proveedores SET nombre=?, tipo_servicio=?, telefono=?, email=?, rfc=?, notas=? WHERE id=?`,
        [form.nombre, form.tipo_servicio, form.telefono, form.email, form.rfc, form.notas, editando])
    } else {
      run(`INSERT INTO proveedores (nombre, tipo_servicio, telefono, email, rfc, notas) VALUES (?,?,?,?,?,?)`,
        [form.nombre, form.tipo_servicio, form.telefono, form.email, form.rfc, form.notas])
    }
    setModal(false); loadProveedores()
  }

  function savePago() {
    const e = {}
    if (!pagoForm.fecha) e.fecha = 'Requerida'
    if (!pagoForm.concepto.trim()) e.concepto = 'Requerido'
    if (!pagoForm.importe || Number(pagoForm.importe) <= 0) e.importe = 'Inválido'
    setPagoModal(e)
    if (Object.keys(e).length) return
    run(`INSERT INTO pagos_proveedores (proveedor_id, fecha, concepto, importe, cuenta_bancaria_id, referencia) VALUES (?,?,?,?,?,?)`,
      [detalle.id, pagoForm.fecha, pagoForm.concepto, Number(pagoForm.importe), pagoForm.cuenta_bancaria_id||null, pagoForm.referencia])
    if (pagoForm.cuenta_bancaria_id) {
      run(`UPDATE cuentas_bancarias SET saldo_actual = saldo_actual - ? WHERE id=?`, [Number(pagoForm.importe), pagoForm.cuenta_bancaria_id])
    }
    setPagoModal(false)
    openDetalle(detalle)
    loadProveedores()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fp = (k, v) => setPagoForm(p => ({ ...p, [k]: v }))

  return (
    <div style={{ flex: 1 }}>
      <PageHeader
        title="Proveedores"
        subtitle="Directorio y historial de pagos"
        actions={<Btn icon={<Plus size={15}/>} onClick={openNew}>Nuevo Proveedor</Btn>}
      />
      <PageContent style={{ display: 'flex', gap: 20, padding: '24px 32px' }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={filtro} onChange={setFiltro} placeholder="Buscar proveedor, servicio, RFC..." style={{ marginBottom: 16 }} />
          <Card>
            <Table headers={['Proveedor', 'Tipo de servicio', 'RFC', 'Pagos', 'Total pagado', '']}>
              {filtered.map(p => (
                <TR key={p.id} onClick={() => openDetalle(p)} highlight={detalle?.id === p.id}>
                  <TD>
                    <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                    <div style={{ fontSize: 11, color: '#6B7B4F', display: 'flex', gap: 8, marginTop: 2 }}>
                      {p.telefono && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={10}/>{p.telefono}</span>}
                      {p.email && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={10}/>{p.email}</span>}
                    </div>
                  </TD>
                  <TD><Badge label={p.tipo_servicio} bg="#EAF0D8" color="#2C3A1A" /></TD>
                  <TD style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B7B4F' }}>{p.rfc || '—'}</TD>
                  <TD style={{ textAlign: 'center' }}>{p.total_pagos}</TD>
                  <TD style={{ fontWeight: 600, color: '#8B1A1A' }}>{formatMXN(p.total_pagado)}</TD>
                  <TD>
                    <button onClick={e => { e.stopPropagation(); openEdit(p) }}
                      style={{ background: 'none', border: '1px solid rgba(196,169,125,0.4)', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                  </TD>
                </TR>
              ))}
            </Table>
          </Card>
        </div>

        {detalle && (
          <div style={{ width: 320, flexShrink: 0 }}>
            <Card style={{ position: 'sticky', top: 20 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(196,169,125,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'Oswald', fontSize: 16, fontWeight: 700, color: '#2C3A1A' }}>{detalle.nombre}</div>
                  <div style={{ fontSize: 12, color: '#6B7B4F', fontFamily: 'DM Sans' }}>{detalle.tipo_servicio}</div>
                </div>
                <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={16} color="#6B7B4F"/>
                </button>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, background: '#F5F0E8', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#6B7B4F', fontFamily: 'DM Sans' }}>Total pagado</div>
                    <div style={{ fontFamily: 'Oswald', fontSize: 16, fontWeight: 700, color: '#8B1A1A' }}>{formatMXN(detalle.total_pagado)}</div>
                  </div>
                  <div style={{ flex: 1, background: '#F5F0E8', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#6B7B4F', fontFamily: 'DM Sans' }}>Pagos</div>
                    <div style={{ fontFamily: 'Oswald', fontSize: 16, fontWeight: 700, color: '#2C3A1A' }}>{detalle.total_pagos}</div>
                  </div>
                </div>
                <Btn size="sm" variant="secondary" icon={<DollarSign size={12}/>}
                  onClick={() => { setPagoForm(EMPTY_PAGO); setPagoModal(true) }}
                  style={{ width: '100%', marginBottom: 12 }}>
                  Registrar Pago
                </Btn>
                <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: '#2C3A1A', marginBottom: 8 }}>Historial de pagos</div>
                {pagos.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#6B7B4F', fontFamily: 'DM Sans' }}>Sin pagos registrados</div>
                ) : pagos.map(p => (
                  <div key={p.id} style={{ borderBottom: '1px solid rgba(196,169,125,0.12)', paddingBottom: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontFamily: 'DM Sans', color: '#2C3A1A' }}>{p.concepto}</span>
                      <span style={{ fontFamily: 'Oswald', fontSize: 14, fontWeight: 700, color: '#8B1A1A' }}>{formatMXN(p.importe)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7B4F', fontFamily: 'DM Sans' }}>
                      {formatDate(p.fecha)} {p.banco ? `· ${p.banco} ···${p.ultimos_4}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </PageContent>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Proveedor' : 'Nuevo Proveedor'} width={480}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Nombre" required error={errors.nombre} style={{ gridColumn: '1/-1' }}>
            <Input value={form.nombre} onChange={e => f('nombre', e.target.value)} />
          </FormField>
          <FormField label="Tipo de servicio" required error={errors.tipo_servicio} style={{ gridColumn: '1/-1' }}>
            <Input value={form.tipo_servicio} onChange={e => f('tipo_servicio', e.target.value)} placeholder="Transporte turístico, Hospedaje..." />
          </FormField>
          <FormField label="Teléfono"><Input value={form.telefono} onChange={e => f('telefono', e.target.value)} /></FormField>
          <FormField label="Email"><Input type="email" value={form.email} onChange={e => f('email', e.target.value)} /></FormField>
          <FormField label="RFC" style={{ gridColumn: '1/-1' }}><Input value={form.rfc} onChange={e => f('rfc', e.target.value)} placeholder="ABC123456XYZ" /></FormField>
          <FormField label="Notas" style={{ gridColumn: '1/-1' }}><Textarea value={form.notas} onChange={e => f('notas', e.target.value)} rows={2} /></FormField>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="outline" onClick={() => setModal(false)}>Cancelar</Btn>
          <Btn onClick={handleSave}>{editando ? 'Guardar' : 'Crear'}</Btn>
        </div>
      </Modal>

      <Modal open={pagoModal} onClose={() => setPagoModal(false)} title={`Pago a ${detalle?.nombre}`} width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Fecha" required><Input type="date" value={pagoForm.fecha} onChange={e => fp('fecha', e.target.value)} /></FormField>
          <FormField label="Concepto" required><Input value={pagoForm.concepto} onChange={e => fp('concepto', e.target.value)} /></FormField>
          <FormField label="Importe (MXN)" required><Input type="number" min="0.01" value={pagoForm.importe} onChange={e => fp('importe', e.target.value)} /></FormField>
          <FormField label="Cuenta de origen">
            <Select value={pagoForm.cuenta_bancaria_id} onChange={e => fp('cuenta_bancaria_id', e.target.value)}>
              <option value="">— Seleccionar —</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.banco} ···{c.ultimos_4}</option>)}
            </Select>
          </FormField>
          <FormField label="Referencia"><Input value={pagoForm.referencia} onChange={e => fp('referencia', e.target.value)} /></FormField>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="outline" onClick={() => setPagoModal(false)}>Cancelar</Btn>
          <Btn onClick={savePago} variant="secondary">Registrar Pago</Btn>
        </div>
      </Modal>
    </div>
  )
}
