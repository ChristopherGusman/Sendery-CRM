import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
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
  // Candado contra doble clic: dos clics seguidos en el botón de guardar
  // insertaban el registro dos veces.
  const [saving, setSaving] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [pagos, setPagos] = useState([])
  const [pagoModal, setPagoModal] = useState(false)
  const [pagoForm, setPagoForm] = useState(EMPTY_PAGO)
  const [cuentas, setCuentas] = useState([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [provRes, cuentasRes] = await Promise.all([
      supabase.from('proveedores')
        .select('*, pagos_proveedores(id, importe)')
        .order('nombre'),
      supabase.from('cuentas_bancarias').select('*').order('banco'),
    ])

    const rows = (provRes.data || []).map(p => ({
      ...p,
      total_pagos: (p.pagos_proveedores || []).length,
      total_pagado: (p.pagos_proveedores || []).reduce((s, pp) => s + Number(pp.importe), 0),
    }))
    setProveedores(rows)
    setCuentas(cuentasRes.data || [])
  }

  async function loadProveedores() {
    const { data } = await supabase
      .from('proveedores')
      .select('*, pagos_proveedores(id, importe)')
      .order('nombre')

    const rows = (data || []).map(p => ({
      ...p,
      total_pagos: (p.pagos_proveedores || []).length,
      total_pagado: (p.pagos_proveedores || []).reduce((s, pp) => s + Number(pp.importe), 0),
    }))
    setProveedores(rows)
  }

  async function openDetalle(p) {
    setDetalle(p)
    const { data } = await supabase
      .from('pagos_proveedores')
      .select('*, cuentas_bancarias(banco, ultimos_4)')
      .eq('proveedor_id', p.id)
      .order('fecha', { ascending: false })

    setPagos((data || []).map(pp => ({
      ...pp,
      banco: pp.cuentas_bancarias?.banco || null,
      ultimos_4: pp.cuentas_bancarias?.ultimos_4 || null,
    })))
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

  async function handleSave() {
    if (saving) return
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'Nombre requerido'
    if (!form.tipo_servicio.trim()) e.tipo_servicio = 'Tipo de servicio requerido'
    setErrors(e)
    if (Object.keys(e).length) return
    const payload = {
      nombre: form.nombre, tipo_servicio: form.tipo_servicio,
      telefono: form.telefono, email: form.email, rfc: form.rfc, notas: form.notas
    }
    setSaving(true)
    try {
      const { error } = editando
        ? await supabase.from('proveedores').update(payload).eq('id', editando)
        : await supabase.from('proveedores').insert(payload)
      if (error) { alert(`No se pudo guardar: ${error.message}`); return }
      setModal(false); loadProveedores()
    } finally {
      setSaving(false)
    }
  }

  async function savePago() {
    if (saving) return
    const e = {}
    if (!pagoForm.fecha) e.fecha = 'Requerida'
    if (!pagoForm.concepto.trim()) e.concepto = 'Requerido'
    if (!pagoForm.importe || Number(pagoForm.importe) <= 0) e.importe = 'Inválido'
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    try {
      const { error } = await supabase.from('pagos_proveedores').insert({
        proveedor_id: detalle.id,
        fecha: pagoForm.fecha,
        concepto: pagoForm.concepto,
        importe: Number(pagoForm.importe),
        cuenta_bancaria_id: pagoForm.cuenta_bancaria_id || null,
        referencia: pagoForm.referencia,
      })
      if (error) { alert(`No se pudo registrar el pago: ${error.message}`); return }
      if (pagoForm.cuenta_bancaria_id) {
        const cuenta = cuentas.find(c => c.id == pagoForm.cuenta_bancaria_id)
        if (cuenta) {
          // Saldo tomado de la base, no del valor que traía la pantalla.
          const { data: cAct } = await supabase
            .from('cuentas_bancarias').select('saldo_actual').eq('id', cuenta.id).single()
          await supabase.from('cuentas_bancarias')
            .update({ saldo_actual: Number(cAct?.saldo_actual || 0) - Number(pagoForm.importe) })
            .eq('id', cuenta.id)
        }
      }
      setPagoModal(false)
      openDetalle(detalle)
      loadProveedores()
    } finally {
      setSaving(false)
    }
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
                  onClick={() => { setPagoForm(EMPTY_PAGO); setErrors({}); setPagoModal(true) }}
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
          <Btn onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : editando ? 'Guardar' : 'Crear'}
          </Btn>
        </div>
      </Modal>

      <Modal open={pagoModal} onClose={() => setPagoModal(false)} title={`Pago a ${detalle?.nombre}`} width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Fecha" required error={errors.fecha}><Input type="date" value={pagoForm.fecha} onChange={e => fp('fecha', e.target.value)} /></FormField>
          <FormField label="Concepto" required error={errors.concepto}><Input value={pagoForm.concepto} onChange={e => fp('concepto', e.target.value)} /></FormField>
          <FormField label="Importe (MXN)" required error={errors.importe}><Input type="number" min="0.01" value={pagoForm.importe} onChange={e => fp('importe', e.target.value)} /></FormField>
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
          <Btn onClick={savePago} variant="secondary" disabled={saving}>
            {saving ? 'Registrando...' : 'Registrar Pago'}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}
