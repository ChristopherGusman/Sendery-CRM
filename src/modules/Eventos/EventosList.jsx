import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { query, run, getLastInsertId } from '../../db/database.js'
import { formatMXN, formatDate, getEventoStatus, today } from '../../utils/format.js'
import {
  PageHeader, PageContent, Card, Btn, Badge, Table, TR, TD,
  Modal, FormField, Input, Select, Textarea, SearchBar
} from '../../components/Layout.jsx'
import { Plus, MapPin, Users, DollarSign, Edit2 } from 'lucide-react'

const EMPTY_FORM = {
  nombre: '', tipo: 'caminata', fecha: today(), lugar: '', ejecutor: '',
  costo_total: '', cupo_maximo: '', estado: 'activo', notas: ''
}

export default function EventosList() {
  const navigate = useNavigate()
  const [eventos, setEventos] = useState([])
  const [filtro, setFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => { loadEventos() }, [])

  function loadEventos() {
    const rows = query(`
      SELECT e.*,
        COUNT(DISTINCT p.id) as participantes,
        COALESCE(SUM(a.monto),0) as ingresos_reales,
        COALESCE(SUM(p.saldo_pendiente),0) as saldo_total
      FROM eventos e
      LEFT JOIN participantes p ON p.evento_id = e.id
      LEFT JOIN abonos a ON a.evento_id = e.id
      GROUP BY e.id
      ORDER BY e.fecha DESC
    `)
    setEventos(rows)
  }

  const filtered = eventos.filter(e => {
    const matchText = !filtro || e.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      e.lugar.toLowerCase().includes(filtro.toLowerCase()) ||
      e.ejecutor.toLowerCase().includes(filtro.toLowerCase())
    const matchTipo = !tipoFiltro || e.tipo === tipoFiltro
    const matchEstado = !estadoFiltro || e.estado === estadoFiltro
    return matchText && matchTipo && matchEstado
  })

  function openNew() { setForm(EMPTY_FORM); setEditando(null); setErrors({}); setModalOpen(true) }
  function openEdit(ev) {
    setForm({
      nombre: ev.nombre, tipo: ev.tipo, fecha: ev.fecha, lugar: ev.lugar,
      ejecutor: ev.ejecutor, costo_total: ev.costo_total, cupo_maximo: ev.cupo_maximo,
      estado: ev.estado, notas: ev.notas || ''
    })
    setEditando(ev.id)
    setErrors({})
    setModalOpen(true)
  }

  function validate() {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'Nombre requerido'
    if (!form.fecha) e.fecha = 'Fecha requerida'
    if (!form.lugar.trim()) e.lugar = 'Lugar requerido'
    if (!form.ejecutor.trim()) e.ejecutor = 'Ejecutor requerido'
    if (form.costo_total !== '' && Number(form.costo_total) < 0) e.costo_total = 'No puede ser negativo'
    if (form.cupo_maximo !== '' && Number(form.cupo_maximo) < 0) e.cupo_maximo = 'No puede ser negativo'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) return
    if (editando) {
      run(`UPDATE eventos SET nombre=?, tipo=?, fecha=?, lugar=?, ejecutor=?,
        costo_total=?, cupo_maximo=?, estado=?, notas=? WHERE id=?`, [
        form.nombre, form.tipo, form.fecha, form.lugar, form.ejecutor,
        Number(form.costo_total)||0, Number(form.cupo_maximo)||0,
        form.estado, form.notas, editando
      ])
    } else {
      run(`INSERT INTO eventos (nombre, tipo, fecha, lugar, ejecutor, costo_total, cupo_maximo, estado, notas)
        VALUES (?,?,?,?,?,?,?,?,?)`, [
        form.nombre, form.tipo, form.fecha, form.lugar, form.ejecutor,
        Number(form.costo_total)||0, Number(form.cupo_maximo)||0,
        form.estado, form.notas
      ])
    }
    setModalOpen(false)
    loadEventos()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div style={{ flex: 1 }}>
      <PageHeader
        title="Eventos"
        subtitle="Caminatas y viajes organizados"
        actions={<Btn icon={<Plus size={15}/>} onClick={openNew}>Nuevo Evento</Btn>}
      />
      <PageContent>
        {/* Filtros */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <SearchBar
            value={filtro} onChange={setFiltro}
            placeholder="Buscar por nombre, lugar o ejecutor..."
            style={{ flex: 1, minWidth: 220 }}
          />
          <Select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} style={{ width: 150 }}>
            <option value="">Todos los tipos</option>
            <option value="caminata">Caminata</option>
            <option value="viaje">Viaje</option>
          </Select>
          <Select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)} style={{ width: 150 }}>
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="cerrado">Cerrado</option>
            <option value="cancelado">Cancelado</option>
          </Select>
        </div>

        {/* Cards de eventos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: '#6B7B4F', fontFamily: 'DM Sans' }}>
              Sin eventos encontrados
            </div>
          ) : filtered.map(ev => {
            const est = getEventoStatus(ev.estado)
            const ocupacion = ev.cupo_maximo > 0 ? Math.round((ev.participantes / ev.cupo_maximo) * 100) : null
            const utilidad = Number(ev.ingresos_reales) - Number(ev.costo_total)

            return (
              <div key={ev.id} style={{
                background: '#fff', borderRadius: 12,
                border: '1px solid rgba(196,169,125,0.25)',
                boxShadow: '0 1px 4px rgba(44,58,26,0.06)',
                overflow: 'hidden', cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s'
              }}
                onClick={() => navigate(`/eventos/${ev.id}`)}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(44,58,26,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 4px rgba(44,58,26,0.06)' }}
              >
                {/* Header de la card */}
                <div style={{
                  background: ev.tipo === 'caminata' ? '#2C3A1A' : '#4A5E28',
                  padding: '16px 18px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                }}>
                  <div>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>
                      {ev.tipo === 'caminata' ? '🥾' : '✈️'}
                    </div>
                    <div style={{
                      fontFamily: 'DM Sans', fontSize: 12,
                      color: '#C4A97D', textTransform: 'uppercase', letterSpacing: 0.5
                    }}>{ev.tipo}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Badge label={est.label} bg={est.bg} color={est.color} />
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(ev) }}
                      style={{
                        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6,
                        padding: 6, cursor: 'pointer', color: '#E8C547'
                      }}
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                </div>

                <div style={{ padding: '16px 18px' }}>
                  <h3 style={{
                    fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 600,
                    color: '#2C3A1A', margin: '0 0 8px', letterSpacing: 0.3
                  }}>{ev.nombre}</h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7B4F', fontFamily: 'DM Sans' }}>
                      <MapPin size={12} color="#4A5E28" />
                      {ev.lugar}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7B4F', fontFamily: 'DM Sans' }}>
                      <Users size={12} color="#4A5E28" />
                      {ev.participantes} participantes {ev.cupo_maximo > 0 ? `de ${ev.cupo_maximo}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7B4F', fontFamily: 'DM Sans' }}>
                      📅 {formatDate(ev.fecha)} · {ev.ejecutor}
                    </div>
                  </div>

                  {/* Barra de ocupación */}
                  {ocupacion !== null && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7B4F', marginBottom: 4, fontFamily: 'DM Sans' }}>
                        <span>Ocupación</span><span>{ocupacion}%</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(196,169,125,0.2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${Math.min(ocupacion,100)}%`,
                          background: ocupacion >= 90 ? '#E8C547' : '#4A5E28',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Financiero */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 8, borderTop: '1px solid rgba(196,169,125,0.15)', paddingTop: 14
                  }}>
                    {[
                      { label: 'Ingresos', val: ev.ingresos_reales, color: '#2C3A1A' },
                      { label: 'Costo', val: ev.costo_total, color: '#8B1A1A' },
                      { label: 'Utilidad', val: utilidad, color: utilidad >= 0 ? '#2C3A1A' : '#8B1A1A' }
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#6B7B4F', fontFamily: 'DM Sans', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'Oswald' }}>
                          {formatMXN(val)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {ev.saldo_total > 0 && (
                    <div style={{
                      marginTop: 10, background: '#FFF3CC', borderRadius: 6, padding: '6px 10px',
                      fontSize: 12, color: '#7A5A00', fontFamily: 'DM Sans', fontWeight: 500
                    }}>
                      ⚠ Saldo pendiente: {formatMXN(ev.saldo_total)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </PageContent>

      {/* Modal Alta/Edición */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Evento' : 'Nuevo Evento'} width={580}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FormField label="Nombre del evento" required error={errors.nombre} style={{ gridColumn: '1/-1' }}>
            <Input value={form.nombre} onChange={e => f('nombre', e.target.value)} placeholder="Caminata Sierra Juárez..." />
          </FormField>

          <FormField label="Tipo" required>
            <Select value={form.tipo} onChange={e => f('tipo', e.target.value)}>
              <option value="caminata">🥾 Caminata</option>
              <option value="viaje">✈️ Viaje</option>
            </Select>
          </FormField>

          <FormField label="Estado">
            <Select value={form.estado} onChange={e => f('estado', e.target.value)}>
              <option value="activo">Activo</option>
              <option value="cerrado">Cerrado</option>
              <option value="cancelado">Cancelado</option>
            </Select>
          </FormField>

          <FormField label="Fecha" required error={errors.fecha}>
            <Input type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)} />
          </FormField>

          <FormField label="Ejecutor responsable" required error={errors.ejecutor}>
            <Input value={form.ejecutor} onChange={e => f('ejecutor', e.target.value)} placeholder="Nombre del guía o responsable" />
          </FormField>

          <FormField label="Lugar / Ruta" required error={errors.lugar} style={{ gridColumn: '1/-1' }}>
            <Input value={form.lugar} onChange={e => f('lugar', e.target.value)} placeholder="Punta Banda, Ensenada BC" />
          </FormField>

          <FormField label="Costo total del evento (MXN)" error={errors.costo_total}>
            <Input type="number" min="0" value={form.costo_total}
              onChange={e => f('costo_total', e.target.value)} placeholder="0.00" />
          </FormField>

          <FormField label="Cupo máximo" error={errors.cupo_maximo}>
            <Input type="number" min="0" value={form.cupo_maximo}
              onChange={e => f('cupo_maximo', e.target.value)} placeholder="15" />
          </FormField>

          <FormField label="Notas" style={{ gridColumn: '1/-1' }}>
            <Textarea value={form.notas} onChange={e => f('notas', e.target.value)}
              placeholder="Información adicional del evento..." rows={3} />
          </FormField>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Btn>
          <Btn onClick={handleSave}>{editando ? 'Guardar Cambios' : 'Crear Evento'}</Btn>
        </div>
      </Modal>
    </div>
  )
}
