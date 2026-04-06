import React, { useState, useEffect } from 'react'
import { query, run } from '../../db/database.js'
import { formatMXN, formatDate, today } from '../../utils/format.js'
import {
  PageHeader, PageContent, Card, Btn, Badge, Table, TR, TD,
  Modal, FormField, Input, Select, SearchBar
} from '../../components/Layout.jsx'
import { Plus, TrendingUp, TrendingDown, X, Landmark } from 'lucide-react'

const EMPTY = { banco: '', ultimos_4: '', titular: '', tipo: 'cheques', saldo_actual: '' }
const EMPTY_MOV = { fecha: today(), tipo: 'ingreso', concepto: '', importe: '', referencia: '', evento_id: '' }

export default function CuentasBancarias() {
  const [cuentas, setCuentas] = useState([])
  const [seleccionada, setSeleccionada] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [filtroMov, setFiltroMov] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [movModal, setMovModal] = useState(false)
  const [movForm, setMovForm] = useState(EMPTY_MOV)
  const [eventos, setEventos] = useState([])

  useEffect(() => {
    loadCuentas()
    setEventos(query(`SELECT id, nombre FROM eventos ORDER BY fecha DESC`))
  }, [])

  function loadCuentas() {
    const rows = query(`
      SELECT cb.*,
        COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.importe ELSE 0 END),0) as total_ingresos,
        COALESCE(SUM(CASE WHEN m.tipo='egreso' THEN m.importe ELSE 0 END),0) as total_egresos,
        COUNT(m.id) as num_movimientos
      FROM cuentas_bancarias cb
      LEFT JOIN movimientos m ON m.cuenta_id = cb.id
      GROUP BY cb.id ORDER BY cb.banco
    `)
    setCuentas(rows)
  }

  function loadMovimientos(cid) {
    const rows = query(`
      SELECT m.*, e.nombre as evento_nombre
      FROM movimientos m
      LEFT JOIN eventos e ON e.id = m.evento_id
      WHERE m.cuenta_id = ? ORDER BY m.fecha DESC, m.id DESC
    `, [cid])
    setMovimientos(rows)
  }

  function seleccionar(c) {
    setSeleccionada(c)
    loadMovimientos(c.id)
  }

  const filteredMov = movimientos.filter(m =>
    !filtroMov ||
    m.concepto.toLowerCase().includes(filtroMov.toLowerCase()) ||
    (m.referencia||'').toLowerCase().includes(filtroMov.toLowerCase())
  )

  function openNew() { setForm(EMPTY); setEditando(null); setErrors({}); setModal(true) }
  function openEdit(c) {
    setForm({ banco: c.banco, ultimos_4: c.ultimos_4, titular: c.titular, tipo: c.tipo, saldo_actual: c.saldo_actual })
    setEditando(c.id); setErrors({}); setModal(true)
  }

  function handleSave() {
    const e = {}
    if (!form.banco.trim()) e.banco = 'Banco requerido'
    if (!form.titular.trim()) e.titular = 'Titular requerido'
    if (!form.ultimos_4 || form.ultimos_4.length !== 4) e.ultimos_4 = '4 dígitos requeridos'
    setErrors(e)
    if (Object.keys(e).length) return
    if (editando) {
      run(`UPDATE cuentas_bancarias SET banco=?, ultimos_4=?, titular=?, tipo=?, saldo_actual=? WHERE id=?`,
        [form.banco, form.ultimos_4, form.titular, form.tipo, Number(form.saldo_actual)||0, editando])
    } else {
      run(`INSERT INTO cuentas_bancarias (banco, ultimos_4, titular, tipo, saldo_actual) VALUES (?,?,?,?,?)`,
        [form.banco, form.ultimos_4, form.titular, form.tipo, Number(form.saldo_actual)||0])
    }
    setModal(false); loadCuentas()
  }

  function saveMov() {
    const e = {}
    if (!movForm.fecha) e.fecha = 'Requerida'
    if (!movForm.concepto.trim()) e.concepto = 'Requerido'
    if (!movForm.importe || Number(movForm.importe) <= 0) e.importe = 'Inválido'
    setErrors(e)
    if (Object.keys(e).length) return
    const monto = Number(movForm.importe)
    run(`INSERT INTO movimientos (cuenta_id, fecha, tipo, concepto, importe, referencia, evento_id) VALUES (?,?,?,?,?,?,?)`,
      [seleccionada.id, movForm.fecha, movForm.tipo, movForm.concepto, monto,
       movForm.referencia, movForm.evento_id||null])
    const delta = movForm.tipo === 'ingreso' ? monto : -monto
    run(`UPDATE cuentas_bancarias SET saldo_actual = saldo_actual + ? WHERE id=?`, [delta, seleccionada.id])
    setMovModal(false); loadCuentas(); loadMovimientos(seleccionada.id)
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fm = (k, v) => setMovForm(p => ({ ...p, [k]: v }))

  const totalSaldos = cuentas.reduce((s, c) => s + Number(c.saldo_actual), 0)

  return (
    <div style={{ flex: 1 }}>
      <PageHeader
        title="Cuentas Bancarias"
        subtitle="Saldos y movimientos"
        actions={<Btn icon={<Plus size={15}/>} onClick={openNew}>Nueva Cuenta</Btn>}
      />
      <PageContent>
        {/* Resumen total */}
        <div style={{
          background: '#2C3A1A', borderRadius: 12, padding: '20px 28px',
          marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ color: '#C4A97D', fontFamily: 'DM Sans', fontSize: 12, marginBottom: 4 }}>SALDO TOTAL EN TODAS LAS CUENTAS</div>
            <div style={{ color: '#E8C547', fontFamily: 'Oswald', fontSize: 36, fontWeight: 700 }}>{formatMXN(totalSaldos)}</div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {cuentas.map(c => (
              <div key={c.id} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#C4A97D', fontFamily: 'DM Sans', marginBottom: 2 }}>{c.banco} ···{c.ultimos_4}</div>
                <div style={{ fontFamily: 'Oswald', fontSize: 16, color: '#F5F0E8' }}>{formatMXN(c.saldo_actual)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cards de cuentas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16, marginBottom: 24 }}>
          {cuentas.map(c => {
            const isSelected = seleccionada?.id === c.id
            const iconos = { cheques: '🏦', ahorro: '💰', efectivo: '💵' }
            return (
              <div key={c.id}
                onClick={() => seleccionar(c)}
                style={{
                  background: isSelected ? '#2C3A1A' : '#fff',
                  borderRadius: 12, padding: '18px 20px',
                  border: isSelected ? '2px solid #E8C547' : '1px solid rgba(196,169,125,0.25)',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 22 }}>{iconos[c.tipo] || '🏦'}</div>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, color: isSelected ? '#F5F0E8' : '#2C3A1A', marginTop: 4 }}>
                      {c.banco}
                    </div>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: isSelected ? '#C4A97D' : '#6B7B4F' }}>
                      ···{c.ultimos_4} · {c.tipo}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); openEdit(c) }}
                    style={{ background: 'none', border: `1px solid ${isSelected ? 'rgba(196,169,125,0.3)' : 'rgba(196,169,125,0.4)'}`, borderRadius: 5, padding: '3px 7px', cursor: 'pointer', color: isSelected ? '#C4A97D' : '#4A5E28', fontSize: 12 }}>✏️</button>
                </div>
                <div style={{ fontFamily: 'Oswald', fontSize: 26, fontWeight: 700, color: isSelected ? '#E8C547' : '#2C3A1A' }}>
                  {formatMXN(c.saldo_actual)}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: '#4A5E28', display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'DM Sans' }}>
                    <TrendingUp size={11}/> {formatMXN(c.total_ingresos)}
                  </span>
                  <span style={{ fontSize: 11, color: '#8B1A1A', display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'DM Sans' }}>
                    <TrendingDown size={11}/> {formatMXN(c.total_egresos)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Movimientos de la cuenta seleccionada */}
        {seleccionada && (
          <Card
            title={`Movimientos — ${seleccionada.banco} ···${seleccionada.ultimos_4}`}
            headerActions={
              <div style={{ display: 'flex', gap: 8 }}>
                <SearchBar value={filtroMov} onChange={setFiltroMov} placeholder="Buscar..." style={{ width: 200 }} />
                <Btn size="sm" variant="secondary" icon={<Plus size={12}/>}
                  onClick={() => { setMovForm(EMPTY_MOV); setErrors({}); setMovModal(true) }}>
                  Movimiento
                </Btn>
                <button onClick={() => setSeleccionada(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7B4F' }}>
                  <X size={16}/>
                </button>
              </div>
            }
          >
            <Table headers={['Fecha', 'Tipo', 'Concepto', 'Evento', 'Referencia', 'Importe', 'Saldo est.']}>
              {filteredMov.length === 0 ? (
                <TR><TD style={{ textAlign: 'center', color: '#6B7B4F' }}>Sin movimientos</TD></TR>
              ) : (() => {
                let saldoAcum = Number(seleccionada.saldo_actual)
                return [...filteredMov].reverse().map((m, i, arr) => {
                  const s = saldoAcum
                  if (m.tipo === 'ingreso') saldoAcum -= Number(m.importe)
                  else saldoAcum += Number(m.importe)
                  return (
                    <TR key={m.id}>
                      <TD style={{ color: '#6B7B4F', fontSize: 12 }}>{formatDate(m.fecha)}</TD>
                      <TD>
                        <Badge
                          label={m.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                          bg={m.tipo === 'ingreso' ? '#EAF0D8' : '#FCECEA'}
                          color={m.tipo === 'ingreso' ? '#2C3A1A' : '#8B1A1A'}
                        />
                      </TD>
                      <TD style={{ fontWeight: 500 }}>{m.concepto}</TD>
                      <TD style={{ fontSize: 12, color: '#6B7B4F' }}>{m.evento_nombre || '—'}</TD>
                      <TD style={{ fontSize: 11, color: '#6B7B4F', fontFamily: 'monospace' }}>{m.referencia || '—'}</TD>
                      <TD style={{ fontWeight: 700, color: m.tipo === 'ingreso' ? '#2C3A1A' : '#8B1A1A' }}>
                        {m.tipo === 'ingreso' ? '+' : '-'}{formatMXN(m.importe)}
                      </TD>
                      <TD style={{ fontWeight: 600, color: '#4A5E28', fontSize: 12 }}>{formatMXN(s)}</TD>
                    </TR>
                  )
                }).reverse()
              })()}
            </Table>
          </Card>
        )}
      </PageContent>

      {/* Modal cuenta */}
      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Cuenta' : 'Nueva Cuenta'} width={440}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Banco" required error={errors.banco} style={{ gridColumn: '1/-1' }}>
            <Input value={form.banco} onChange={e => f('banco', e.target.value)} placeholder="BBVA, Bancomer, Santander..." />
          </FormField>
          <FormField label="Últimos 4 dígitos" required error={errors.ultimos_4}>
            <Input value={form.ultimos_4} onChange={e => f('ultimos_4', e.target.value.slice(0,4))} maxLength={4} placeholder="0000" />
          </FormField>
          <FormField label="Tipo">
            <Select value={form.tipo} onChange={e => f('tipo', e.target.value)}>
              <option value="cheques">Cheques</option>
              <option value="ahorro">Ahorro</option>
              <option value="efectivo">Efectivo</option>
            </Select>
          </FormField>
          <FormField label="Titular" required error={errors.titular} style={{ gridColumn: '1/-1' }}>
            <Input value={form.titular} onChange={e => f('titular', e.target.value)} />
          </FormField>
          <FormField label="Saldo actual (MXN)" style={{ gridColumn: '1/-1' }}>
            <Input type="number" min="0" value={form.saldo_actual} onChange={e => f('saldo_actual', e.target.value)} />
          </FormField>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="outline" onClick={() => setModal(false)}>Cancelar</Btn>
          <Btn onClick={handleSave}>{editando ? 'Guardar' : 'Crear Cuenta'}</Btn>
        </div>
      </Modal>

      {/* Modal movimiento */}
      <Modal open={movModal} onClose={() => setMovModal(false)} title="Registrar Movimiento" width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Fecha" required error={errors.fecha}><Input type="date" value={movForm.fecha} onChange={e => fm('fecha', e.target.value)} /></FormField>
          <FormField label="Tipo">
            <Select value={movForm.tipo} onChange={e => fm('tipo', e.target.value)}>
              <option value="ingreso">↑ Ingreso</option>
              <option value="egreso">↓ Egreso</option>
            </Select>
          </FormField>
          <FormField label="Concepto" required error={errors.concepto}><Input value={movForm.concepto} onChange={e => fm('concepto', e.target.value)} /></FormField>
          <FormField label="Importe (MXN)" required error={errors.importe}><Input type="number" min="0.01" value={movForm.importe} onChange={e => fm('importe', e.target.value)} /></FormField>
          <FormField label="Referencia"><Input value={movForm.referencia} onChange={e => fm('referencia', e.target.value)} /></FormField>
          <FormField label="Evento asociado">
            <Select value={movForm.evento_id} onChange={e => fm('evento_id', e.target.value)}>
              <option value="">— Sin evento —</option>
              {eventos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </Select>
          </FormField>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="outline" onClick={() => setMovModal(false)}>Cancelar</Btn>
          <Btn onClick={saveMov} variant="secondary">Registrar</Btn>
        </div>
      </Modal>
    </div>
  )
}
