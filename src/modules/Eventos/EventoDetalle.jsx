import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { formatMXN, formatDate, getPaymentStatus, getEventoStatus, generateFolio, today } from '../../utils/format.js'
import {
  PageHeader, PageContent, Card, Btn, Badge, Table, TR, TD,
  Modal, FormField, Input, Select, Textarea
} from '../../components/Layout.jsx'
import { ArrowLeft, Plus, DollarSign, Users, TrendingUp, FileText, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { generarReciboEvento, generarReciboPorAbono } from '../Reportes/pdfGenerator.js'

const EMPTY_PART = { cliente_id: '', nombre_cliente: '', monto_total_acordado: '', cuenta_destino_pago: '', notas: '' }
const EMPTY_ABONO = { fecha: today(), monto: '', referencia: '', cuenta_destino: '', notas: '' }

export default function EventoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [evento, setEvento] = useState(null)
  const [participantes, setParticipantes] = useState([])
  const [clientes, setClientes] = useState([])
  const [gastos, setGastos] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [expandido, setExpandido] = useState({})
  const [partModal, setPartModal] = useState(false)
  const [editPart, setEditPart] = useState(null)
  const [partForm, setPartForm] = useState(EMPTY_PART)
  const [abonoModal, setAbonoModal] = useState(null)
  const [abonoForm, setAbonoForm] = useState(EMPTY_ABONO)
  const [errors, setErrors] = useState({})

  useEffect(() => { loadTodo() }, [id])

  async function loadTodo() {
    const [evRes, partsRes, clientesRes, gastosRes, cuentasRes] = await Promise.all([
      supabase.from('eventos').select('*').eq('id', id).single(),
      supabase.from('participantes')
        .select('*, clientes(telefono, email), abonos(*)')
        .eq('evento_id', id)
        .order('nombre_cliente'),
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('gastos')
        .select('*, proveedores(nombre), cuentas_bancarias(banco, ultimos_4)')
        .eq('evento_id', id)
        .order('fecha'),
      supabase.from('cuentas_bancarias').select('*').order('banco'),
    ])

    setEvento(evRes.data)

    const parts = (partsRes.data || []).map(p => ({
      ...p,
      abonos: (p.abonos || []).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    }))
    setParticipantes(parts)
    setClientes(clientesRes.data || [])

    const gastosMap = (gastosRes.data || []).map(g => ({
      ...g,
      proveedor_nombre: g.proveedores?.nombre || null,
      banco: g.cuentas_bancarias?.banco || null,
      ultimos_4: g.cuentas_bancarias?.ultimos_4 || null,
    }))
    setGastos(gastosMap)
    setCuentas(cuentasRes.data || [])
  }

  if (!evento) return <div style={{ padding: 32, fontFamily: 'DM Sans', color: '#6B7B4F' }}>Cargando...</div>

  const est = getEventoStatus(evento.estado)
  const totalIngresos = participantes.reduce((s, p) => s + p.abonos.reduce((a, b) => a + Number(b.monto), 0), 0)
  const totalAcordado = participantes.reduce((s, p) => s + Number(p.monto_total_acordado), 0)
  const totalSaldo = participantes.reduce((s, p) => s + Number(p.saldo_pendiente), 0)
  const totalGastos = gastos.reduce((s, g) => s + Number(g.importe), 0)
  const utilidad = totalIngresos - totalGastos

  // ── Participante ────────────────────────────────────────────
  function openNuevoPart() { setPartForm(EMPTY_PART); setEditPart(null); setErrors({}); setPartModal(true) }
  function openEditPart(p) {
    setPartForm({
      cliente_id: p.cliente_id || '',
      nombre_cliente: p.nombre_cliente,
      monto_total_acordado: p.monto_total_acordado,
      cuenta_destino_pago: p.cuenta_destino_pago || '',
      notas: p.notas || ''
    })
    setEditPart(p.id)
    setErrors({})
    setPartModal(true)
  }

  async function savePart() {
    const e = {}
    if (!partForm.nombre_cliente.trim()) e.nombre_cliente = 'Nombre requerido'
    if (!partForm.monto_total_acordado || Number(partForm.monto_total_acordado) < 0) e.monto_total_acordado = 'Monto inválido'
    setErrors(e)
    if (Object.keys(e).length) return

    const monto = Number(partForm.monto_total_acordado)
    if (editPart) {
      const { data: abonosData } = await supabase
        .from('abonos').select('monto').eq('participante_id', editPart)
      const abonosSum = (abonosData || []).reduce((s, a) => s + Number(a.monto), 0)
      const newSaldo = Math.max(0, monto - abonosSum)
      await supabase.from('participantes').update({
        cliente_id: partForm.cliente_id || null,
        nombre_cliente: partForm.nombre_cliente,
        monto_total_acordado: monto,
        saldo_pendiente: newSaldo,
        cuenta_destino_pago: partForm.cuenta_destino_pago,
        notas: partForm.notas,
      }).eq('id', editPart)
    } else {
      await supabase.from('participantes').insert({
        evento_id: Number(id),
        cliente_id: partForm.cliente_id || null,
        nombre_cliente: partForm.nombre_cliente,
        monto_total_acordado: monto,
        saldo_pendiente: monto,
        cuenta_destino_pago: partForm.cuenta_destino_pago,
        notas: partForm.notas,
      })
    }
    setPartModal(false)
    loadTodo()
  }

  async function deletePart(pid) {
    if (!confirm('¿Eliminar participante y sus abonos?')) return
    await supabase.from('abonos').delete().eq('participante_id', pid)
    await supabase.from('participantes').delete().eq('id', pid)
    loadTodo()
  }

  // ── Abono ───────────────────────────────────────────────────
  function openAbono(p) {
    setAbonoModal(p)
    setAbonoForm({ ...EMPTY_ABONO, cuenta_destino: p.cuenta_destino_pago || '' })
    setErrors({})
  }

  async function saveAbono() {
    const e = {}
    if (!abonoForm.fecha) e.fecha = 'Fecha requerida'
    if (!abonoForm.monto || Number(abonoForm.monto) <= 0) e.monto = 'Monto inválido'
    setErrors(e)
    if (Object.keys(e).length) return

    const monto = Number(abonoForm.monto)
    const folio = abonoForm.referencia || generateFolio('ABN')

    await supabase.from('abonos').insert({
      participante_id: abonoModal.id,
      evento_id: Number(id),
      cliente_id: abonoModal.cliente_id || null,
      fecha: abonoForm.fecha,
      monto,
      referencia: folio,
      cuenta_destino: abonoForm.cuenta_destino,
      notas: abonoForm.notas,
    })

    const newSaldo = Math.max(0, Number(abonoModal.saldo_pendiente) - monto)
    await supabase.from('participantes').update({
      saldo_pendiente: newSaldo,
      fecha_ultimo_pago: abonoForm.fecha,
    }).eq('id', abonoModal.id)

    const cuenta = cuentas.find(c =>
      `${c.banco} ${c.ultimos_4}` === abonoForm.cuenta_destino ||
      c.banco === abonoForm.cuenta_destino
    )
    if (cuenta) {
      await supabase.from('movimientos').insert({
        cuenta_id: cuenta.id,
        fecha: abonoForm.fecha,
        tipo: 'ingreso',
        concepto: `Abono ${abonoModal.nombre_cliente} — ${evento.nombre}`,
        importe: monto,
        referencia: folio,
        evento_id: Number(id),
      })
      await supabase.from('cuentas_bancarias')
        .update({ saldo_actual: cuenta.saldo_actual + monto })
        .eq('id', cuenta.id)
    }

    setAbonoModal(null)
    loadTodo()
  }

  const fp = (k, v) => setPartForm(p => ({ ...p, [k]: v }))
  const fa = (k, v) => setAbonoForm(p => ({ ...p, [k]: v }))

  return (
    <div style={{ flex: 1 }}>
      <PageHeader
        title={evento.nombre}
        subtitle={`${evento.tipo === 'caminata' ? '🥾 Caminata' : '✈️ Viaje'} · ${formatDate(evento.fecha)} · ${evento.lugar}`}
        actions={
          <>
            <Btn variant="outline" size="sm" icon={<ArrowLeft size={13}/>} onClick={() => navigate('/eventos')}>
              Volver
            </Btn>
            <Btn size="sm" icon={<Plus size={13}/>} onClick={openNuevoPart}>
              Agregar participante
            </Btn>
          </>
        }
      />
      <PageContent>
        {/* Resumen financiero */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total acordado', val: totalAcordado, color: '#2C3A1A' },
            { label: 'Ingresos reales', val: totalIngresos, color: '#4A5E28' },
            { label: 'Por cobrar', val: totalSaldo, color: totalSaldo > 0 ? '#8B1A1A' : '#2C3A1A' },
            { label: 'Total gastos', val: totalGastos, color: '#8B1A1A' },
            { label: 'Utilidad', val: utilidad, color: utilidad >= 0 ? '#2C3A1A' : '#8B1A1A' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{
              background: '#fff', borderRadius: 10, padding: '14px 16px',
              border: '1px solid rgba(196,169,125,0.2)', textAlign: 'center'
            }}>
              <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: '#6B7B4F', marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: 'Oswald', fontSize: 20, fontWeight: 700, color }}>{formatMXN(val)}</div>
            </div>
          ))}
        </div>

        {/* Participantes */}
        <Card title={`Participantes (${participantes.length})`} style={{ marginBottom: 20 }}>
          {participantes.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6B7B4F', fontFamily: 'DM Sans' }}>
              Sin participantes registrados — <button onClick={openNuevoPart} style={{ background: 'none', border: 'none', color: '#4A5E28', cursor: 'pointer', fontWeight: 600 }}>Agregar primero</button>
            </div>
          ) : (
            <div>
              {participantes.map(p => {
                const ps = getPaymentStatus(p.saldo_pendiente, p.monto_total_acordado)
                const isExp = expandido[p.id]
                const pct = p.monto_total_acordado > 0
                  ? Math.round(((p.monto_total_acordado - p.saldo_pendiente) / p.monto_total_acordado) * 100)
                  : 100

                return (
                  <div key={p.id} style={{ borderBottom: '1px solid rgba(196,169,125,0.12)' }}>
                    <div style={{
                      padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
                      cursor: 'pointer'
                    }} onClick={() => setExpandido(x => ({ ...x, [p.id]: !x[p.id] }))}>
                      {/* Avatar */}
                      <div style={{
                        width: 38, height: 38, background: '#EAF0D8', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Oswald', fontSize: 14, color: '#2C3A1A', fontWeight: 700, flexShrink: 0
                      }}>
                        {p.nombre_cliente.split(' ').map(w => w[0]).slice(0,2).join('')}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600, color: '#2C3A1A' }}>
                            {p.nombre_cliente}
                          </span>
                          <Badge label={ps.label} bg={ps.bg} color={ps.color} />
                        </div>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: '#6B7B4F' }}>
                            Total: {formatMXN(p.monto_total_acordado)}
                          </span>
                          <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: p.saldo_pendiente > 0 ? '#8B1A1A' : '#4A5E28', fontWeight: 500 }}>
                            Saldo: {formatMXN(p.saldo_pendiente)}
                          </span>
                          <div style={{ flex: 1, maxWidth: 120 }}>
                            <div style={{ height: 4, background: 'rgba(196,169,125,0.2)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${pct}%`, borderRadius: 2,
                                background: pct === 100 ? '#4A5E28' : pct > 50 ? '#E8C547' : '#C4A97D'
                              }} />
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: '#6B7B4F' }}>{pct}%</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Btn size="sm" variant="secondary"
                          icon={<DollarSign size={12}/>}
                          onClick={e => { e.stopPropagation(); openAbono(p) }}>
                          Abonar
                        </Btn>
                        <button onClick={e => { e.stopPropagation(); generarReciboEvento(evento, p, p.abonos) }}
                          style={{ background: 'none', border: '1px solid rgba(196,169,125,0.4)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#4A5E28' }}>
                          <FileText size={14} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); openEditPart(p) }}
                          style={{ background: 'none', border: '1px solid rgba(196,169,125,0.4)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#4A5E28' }}>
                          ✏️
                        </button>
                        <button onClick={e => { e.stopPropagation(); deletePart(p.id) }}
                          style={{ background: 'none', border: '1px solid #f5c6c6', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#8B1A1A' }}>
                          <Trash2 size={13} />
                        </button>
                        {isExp ? <ChevronUp size={16} color="#6B7B4F"/> : <ChevronDown size={16} color="#6B7B4F"/>}
                      </div>
                    </div>

                    {/* Detalle de abonos expandido */}
                    {isExp && (
                      <div style={{ background: 'rgba(245,240,232,0.5)', padding: '0 20px 16px 72px' }}>
                        {p.abonos.length === 0 ? (
                          <div style={{ fontFamily: 'DM Sans', fontSize: 13, color: '#6B7B4F', padding: '8px 0' }}>
                            Sin abonos registrados
                          </div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'DM Sans', fontSize: 12 }}>
                            <thead>
                              <tr style={{ color: '#6B7B4F', borderBottom: '1px solid rgba(196,169,125,0.2)' }}>
                                <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 600 }}>Fecha</th>
                                <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 600 }}>Monto</th>
                                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Referencia</th>
                                <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 600 }}>Cuenta</th>
                                <th style={{ textAlign: 'center', padding: '6px 0', fontWeight: 600 }}>PDF</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.abonos.map(a => (
                                <tr key={a.id} style={{ borderBottom: '1px solid rgba(196,169,125,0.1)' }}>
                                  <td style={{ padding: '6px 0', color: '#6B7B4F' }}>{formatDate(a.fecha)}</td>
                                  <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#2C3A1A' }}>
                                    {formatMXN(a.monto)}
                                  </td>
                                  <td style={{ padding: '6px 8px', color: '#6B7B4F' }}>{a.referencia || '—'}</td>
                                  <td style={{ padding: '6px 0', color: '#6B7B4F' }}>{a.cuenta_destino || '—'}</td>
                                  <td style={{ padding: '6px 0', textAlign: 'center' }}>
                                    <button
                                      title="Generar recibo de este abono"
                                      onClick={() => generarReciboPorAbono(evento, p, a)}
                                      style={{
                                        background: 'none', border: '1px solid rgba(74,94,40,0.35)',
                                        borderRadius: 5, padding: '3px 6px', cursor: 'pointer', color: '#4A5E28',
                                        display: 'inline-flex', alignItems: 'center'
                                      }}>
                                      <FileText size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {p.notas && (
                          <div style={{ marginTop: 8, fontSize: 12, color: '#6B7B4F', fontStyle: 'italic' }}>
                            Nota: {p.notas}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Gastos del evento */}
        <Card title={`Gastos del evento (${gastos.length})`}>
          {gastos.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6B7B4F', fontFamily: 'DM Sans', fontSize: 13 }}>
              Sin gastos registrados para este evento
            </div>
          ) : (
            <Table headers={['Fecha', 'Concepto', 'Categoría', 'Proveedor', 'Importe']}>
              {gastos.map(g => (
                <TR key={g.id}>
                  <TD style={{ color: '#6B7B4F', fontSize: 12 }}>{formatDate(g.fecha)}</TD>
                  <TD style={{ fontWeight: 500 }}>{g.concepto}</TD>
                  <TD><Badge label={g.categoria} bg="#EAF0D8" color="#2C3A1A" /></TD>
                  <TD style={{ color: '#6B7B4F', fontSize: 12 }}>{g.proveedor_nombre || '—'}</TD>
                  <TD style={{ fontWeight: 600, color: '#8B1A1A' }}>{formatMXN(g.importe)}</TD>
                </TR>
              ))}
              <TR>
                <TD style={{ gridColumn: '1/-1' }} />
                <TD /><TD /><TD>
                  <span style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 700, color: '#8B1A1A' }}>Total:</span>
                </TD>
                <TD style={{ fontWeight: 700, color: '#8B1A1A', fontSize: 15 }}>{formatMXN(totalGastos)}</TD>
              </TR>
            </Table>
          )}
        </Card>
      </PageContent>

      {/* Modal participante */}
      <Modal open={partModal} onClose={() => setPartModal(false)}
        title={editPart ? 'Editar Participante' : 'Nuevo Participante'} width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Cliente (opcional)">
            <Select value={partForm.cliente_id} onChange={e => {
              const cid = e.target.value
              const cl = clientes.find(c => c.id == cid)
              fp('cliente_id', cid)
              if (cl) fp('nombre_cliente', cl.nombre)
            }}>
              <option value="">— Sin vincular a cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </FormField>

          <FormField label="Nombre completo" required error={errors.nombre_cliente}>
            <Input value={partForm.nombre_cliente} onChange={e => fp('nombre_cliente', e.target.value)} />
          </FormField>

          <FormField label="Monto total acordado (MXN)" required error={errors.monto_total_acordado}>
            <Input type="number" min="0" value={partForm.monto_total_acordado}
              onChange={e => fp('monto_total_acordado', e.target.value)} placeholder="850.00" />
          </FormField>

          <FormField label="Cuenta destino de pago" hint="Ej: BBVA 4521 / Efectivo">
            <Input value={partForm.cuenta_destino_pago}
              onChange={e => fp('cuenta_destino_pago', e.target.value)} />
          </FormField>

          <FormField label="Notas">
            <Textarea value={partForm.notas} onChange={e => fp('notas', e.target.value)} rows={2} />
          </FormField>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="outline" onClick={() => setPartModal(false)}>Cancelar</Btn>
          <Btn onClick={savePart}>{editPart ? 'Guardar' : 'Agregar'}</Btn>
        </div>
      </Modal>

      {/* Modal abono */}
      <Modal open={!!abonoModal} onClose={() => setAbonoModal(null)}
        title={`Registrar Abono — ${abonoModal?.nombre_cliente}`} width={440}>
        {abonoModal && (
          <>
            <div style={{
              background: '#F5F0E8', borderRadius: 8, padding: '10px 14px',
              fontFamily: 'DM Sans', fontSize: 13, marginBottom: 16
            }}>
              <div>Total acordado: <strong>{formatMXN(abonoModal.monto_total_acordado)}</strong></div>
              <div style={{ color: abonoModal.saldo_pendiente > 0 ? '#8B1A1A' : '#4A5E28' }}>
                Saldo pendiente: <strong>{formatMXN(abonoModal.saldo_pendiente)}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="Fecha del abono" required error={errors.fecha}>
                <Input type="date" value={abonoForm.fecha} onChange={e => fa('fecha', e.target.value)} />
              </FormField>
              <FormField label="Monto del abono (MXN)" required error={errors.monto}>
                <Input type="number" min="0.01" step="0.01" value={abonoForm.monto}
                  onChange={e => fa('monto', e.target.value)}
                  placeholder={`Máx. ${formatMXN(abonoModal.saldo_pendiente)}`} />
              </FormField>
              <FormField label="Referencia / Folio" hint="Se genera automáticamente si se deja en blanco">
                <Input value={abonoForm.referencia} onChange={e => fa('referencia', e.target.value)}
                  placeholder={generateFolio('ABN')} />
              </FormField>
              <FormField label="Cuenta destino">
                <Select value={abonoForm.cuenta_destino} onChange={e => fa('cuenta_destino', e.target.value)}>
                  <option value="">— Seleccionar cuenta —</option>
                  {cuentas.map(c => (
                    <option key={c.id} value={`${c.banco} ${c.ultimos_4}`}>
                      {c.banco} ···{c.ultimos_4} ({c.tipo})
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Notas">
                <Input value={abonoForm.notas} onChange={e => fa('notas', e.target.value)} />
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <Btn variant="outline" onClick={() => setAbonoModal(null)}>Cancelar</Btn>
              <Btn onClick={saveAbono} variant="secondary" icon={<DollarSign size={14}/>}>
                Registrar Abono
              </Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
