import React, { useState, useEffect } from 'react'
import { query, run } from '../../db/database.js'
import { formatMXN, formatDate, getPaymentStatus, today } from '../../utils/format.js'
import {
  PageHeader, PageContent, Card, Btn, Badge, Table, TR, TD,
  Modal, FormField, Input, Textarea, SearchBar
} from '../../components/Layout.jsx'
import { Plus, Phone, Mail, MapPin, X } from 'lucide-react'

const EMPTY = { nombre: '', telefono: '', email: '', ciudad: 'Ensenada', fecha_registro: today(), notas: '' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [filtro, setFiltro] = useState('')
  const [ciudadFiltro, setCiudadFiltro] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [detalle, setDetalle] = useState(null)
  const [historial, setHistorial] = useState([])

  useEffect(() => { loadClientes() }, [])

  function loadClientes() {
    const rows = query(`
      SELECT c.*,
        COUNT(DISTINCT p.evento_id) as total_eventos,
        COALESCE(SUM(a.monto),0) as total_pagado,
        COALESCE(SUM(p.saldo_pendiente),0) as deuda_activa
      FROM clientes c
      LEFT JOIN participantes p ON p.cliente_id = c.id
      LEFT JOIN abonos a ON a.cliente_id = c.id
      GROUP BY c.id ORDER BY c.nombre
    `)
    setClientes(rows)
  }

  function openDetalle(c) {
    setDetalle(c)
    const h = query(`
      SELECT e.nombre as evento, e.fecha, e.tipo,
        p.monto_total_acordado, p.saldo_pendiente,
        COALESCE(SUM(a.monto),0) as pagado
      FROM participantes p
      JOIN eventos e ON e.id = p.evento_id
      LEFT JOIN abonos a ON a.participante_id = p.id
      WHERE p.cliente_id = ?
      GROUP BY p.id ORDER BY e.fecha DESC
    `, [c.id])
    setHistorial(h)
  }

  const filtered = clientes.filter(c => {
    const matchText = !filtro ||
      c.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(filtro.toLowerCase()) ||
      (c.telefono || '').includes(filtro)
    const matchCiudad = !ciudadFiltro || c.ciudad === ciudadFiltro
    return matchText && matchCiudad
  })

  const ciudades = [...new Set(clientes.map(c => c.ciudad).filter(Boolean))].sort()

  function openNew() { setForm(EMPTY); setEditando(null); setErrors({}); setModal(true) }
  function openEdit(c) {
    setForm({ nombre: c.nombre, telefono: c.telefono||'', email: c.email||'', ciudad: c.ciudad||'', fecha_registro: c.fecha_registro||today(), notas: c.notas||'' })
    setEditando(c.id); setErrors({}); setModal(true)
  }

  function validate() {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'Nombre requerido'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) return
    if (editando) {
      run(`UPDATE clientes SET nombre=?, telefono=?, email=?, ciudad=?, fecha_registro=?, notas=? WHERE id=?`,
        [form.nombre, form.telefono, form.email, form.ciudad, form.fecha_registro, form.notas, editando])
    } else {
      run(`INSERT INTO clientes (nombre, telefono, email, ciudad, fecha_registro, notas) VALUES (?,?,?,?,?,?)`,
        [form.nombre, form.telefono, form.email, form.ciudad, form.fecha_registro, form.notas])
    }
    setModal(false); loadClientes()
  }

  function deleteCliente(id) {
    if (!confirm('¿Eliminar cliente? Se mantendrán sus registros históricos.')) return
    run(`UPDATE participantes SET cliente_id=NULL WHERE cliente_id=?`, [id])
    run(`UPDATE abonos SET cliente_id=NULL WHERE cliente_id=?`, [id])
    run(`DELETE FROM clientes WHERE id=?`, [id])
    loadClientes()
    if (detalle?.id === id) setDetalle(null)
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div style={{ flex: 1 }}>
      <PageHeader
        title="Clientes"
        subtitle="Base de datos CRM"
        actions={<Btn icon={<Plus size={15}/>} onClick={openNew}>Nuevo Cliente</Btn>}
      />
      <PageContent style={{ display: 'flex', gap: 20, padding: '24px 32px' }}>
        {/* Lista */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <SearchBar value={filtro} onChange={setFiltro} placeholder="Buscar nombre, email, teléfono..." style={{ flex: 1 }} />
            <select value={ciudadFiltro} onChange={e => setCiudadFiltro(e.target.value)}
              style={{ padding: '9px 12px', border: '1.5px solid rgba(196,169,125,0.4)', borderRadius: 8, fontFamily: 'DM Sans', fontSize: 13, background: '#FDFCFA', color: '#2C3A1A', cursor: 'pointer' }}>
              <option value="">Todas las ciudades</option>
              {ciudades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <Card>
            <Table headers={['Cliente', 'Ciudad', 'Eventos', 'Total pagado', 'Deuda activa', '']}>
              {filtered.length === 0 ? (
                <TR><TD style={{ textAlign: 'center', color: '#6B7B4F', gridColumn: '1/-1' }}>Sin clientes</TD></TR>
              ) : filtered.map(c => {
                const ps = getPaymentStatus(c.deuda_activa, c.deuda_activa + 1)
                return (
                  <TR key={c.id} onClick={() => openDetalle(c)} highlight={detalle?.id === c.id}>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, background: '#EAF0D8', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'Oswald', fontSize: 13, color: '#2C3A1A', fontWeight: 700, flexShrink: 0
                        }}>{c.nombre.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nombre}</div>
                          <div style={{ fontSize: 11, color: '#6B7B4F' }}>{formatDate(c.fecha_registro)}</div>
                        </div>
                      </div>
                    </TD>
                    <TD style={{ color: '#6B7B4F', fontSize: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11}/>{c.ciudad || '—'}
                      </span>
                    </TD>
                    <TD style={{ textAlign: 'center' }}>{c.total_eventos}</TD>
                    <TD style={{ fontWeight: 600 }}>{formatMXN(c.total_pagado)}</TD>
                    <TD>
                      {c.deuda_activa > 0
                        ? <Badge label={formatMXN(c.deuda_activa)} bg={ps.bg} color={ps.color} />
                        : <Badge label="Al corriente" bg="#EAF0D8" color="#2C3A1A" />}
                    </TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(c)}
                          style={{ background: 'none', border: '1px solid rgba(196,169,125,0.4)', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', color: '#4A5E28', fontSize: 12 }}>✏️</button>
                        <button onClick={() => deleteCliente(c.id)}
                          style={{ background: 'none', border: '1px solid #f5c6c6', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', color: '#8B1A1A', fontSize: 12 }}>🗑</button>
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </Table>
          </Card>
        </div>

        {/* Panel de detalle */}
        {detalle && (
          <div style={{ width: 320, flexShrink: 0 }}>
            <Card style={{ position: 'sticky', top: 20 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(196,169,125,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'Oswald', fontSize: 16, fontWeight: 700, color: '#2C3A1A' }}>{detalle.nombre}</div>
                  <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: '#6B7B4F' }}>Cliente desde {formatDate(detalle.fecha_registro)}</div>
                </div>
                <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7B4F' }}>
                  <X size={16}/>
                </button>
              </div>
              <div style={{ padding: '16px 20px' }}>
                {detalle.telefono && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, fontSize: 13, fontFamily: 'DM Sans', color: '#2C3A1A' }}>
                    <Phone size={13} color="#4A5E28"/>{detalle.telefono}
                  </div>
                )}
                {detalle.email && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, fontSize: 13, fontFamily: 'DM Sans', color: '#2C3A1A' }}>
                    <Mail size={13} color="#4A5E28"/>{detalle.email}
                  </div>
                )}
                {detalle.ciudad && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 13, fontFamily: 'DM Sans', color: '#2C3A1A' }}>
                    <MapPin size={13} color="#4A5E28"/>{detalle.ciudad}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {[
                    { label: 'Eventos', val: detalle.total_eventos },
                    { label: 'Total pagado', val: formatMXN(detalle.total_pagado) },
                    { label: 'Deuda activa', val: formatMXN(detalle.deuda_activa), red: detalle.deuda_activa > 0 }
                  ].map(({ label, val, red }) => (
                    <div key={label} style={{ background: '#F5F0E8', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: '#6B7B4F', fontFamily: 'DM Sans', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontFamily: 'Oswald', fontSize: 15, fontWeight: 700, color: red ? '#8B1A1A' : '#2C3A1A' }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: '#2C3A1A', marginBottom: 8 }}>
                  Historial de eventos
                </div>
                {historial.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#6B7B4F', fontFamily: 'DM Sans' }}>Sin participaciones</div>
                ) : historial.map((h, i) => {
                  const ps = getPaymentStatus(h.saldo_pendiente, h.monto_total_acordado)
                  return (
                    <div key={i} style={{ borderBottom: '1px solid rgba(196,169,125,0.12)', paddingBottom: 10, marginBottom: 10 }}>
                      <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: '#2C3A1A', marginBottom: 3 }}>
                        {h.tipo === 'caminata' ? '🥾' : '✈️'} {h.evento}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#6B7B4F' }}>{formatDate(h.fecha)}</span>
                        <Badge label={ps.label} bg={ps.bg} color={ps.color} size="sm" />
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7B4F', marginTop: 2 }}>
                        Pagado: {formatMXN(h.pagado)} / {formatMXN(h.monto_total_acordado)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}
      </PageContent>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Cliente' : 'Nuevo Cliente'} width={480}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Nombre completo" required error={errors.nombre} style={{ gridColumn: '1/-1' }}>
            <Input value={form.nombre} onChange={e => f('nombre', e.target.value)} />
          </FormField>
          <FormField label="Teléfono">
            <Input value={form.telefono} onChange={e => f('telefono', e.target.value)} placeholder="664-000-0000" />
          </FormField>
          <FormField label="Email" error={errors.email}>
            <Input type="email" value={form.email} onChange={e => f('email', e.target.value)} />
          </FormField>
          <FormField label="Ciudad">
            <Input value={form.ciudad} onChange={e => f('ciudad', e.target.value)} placeholder="Ensenada" />
          </FormField>
          <FormField label="Fecha de registro">
            <Input type="date" value={form.fecha_registro} onChange={e => f('fecha_registro', e.target.value)} />
          </FormField>
          <FormField label="Notas" style={{ gridColumn: '1/-1' }}>
            <Textarea value={form.notas} onChange={e => f('notas', e.target.value)} rows={2} />
          </FormField>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="outline" onClick={() => setModal(false)}>Cancelar</Btn>
          <Btn onClick={handleSave}>{editando ? 'Guardar' : 'Crear Cliente'}</Btn>
        </div>
      </Modal>
    </div>
  )
}
