import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { query } from '../../db/database.js'
import { formatMXN, formatDate, getPaymentStatus, getEventoStatus } from '../../utils/format.js'
import {
  PageHeader, PageContent, KPICard, Card, Badge, Table, TR, TD
} from '../../components/Layout.jsx'
import {
  TrendingUp, CalendarDays, Users, AlertCircle, Banknote,
  MapPin, Clock
} from 'lucide-react'

const COLORS = ['#2C3A1A', '#4A5E28', '#E8C547', '#C4A97D', '#6B7B4F', '#8B9E5A']

export default function Dashboard() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState({})
  const [ingresosEvento, setIngresosEvento] = useState([])
  const [evolucionMensual, setEvolucionMensual] = useState([])
  const [gastosCat, setGastosCat] = useState([])
  const [eventosProximos, setEventosProximos] = useState([])
  const [clientesSaldo, setClientesSaldo] = useState([])
  const [pagosRecientes, setPagosRecientes] = useState([])

  useEffect(() => {
    loadDashboard()
  }, [])

  function loadDashboard() {
    // KPIs
    const hoy = new Date().toISOString().split('T')[0]
    const mesInicio = hoy.slice(0,7) + '-01'

    const ingresosMes = query(
      `SELECT COALESCE(SUM(monto),0) as total FROM abonos WHERE fecha >= ?`, [mesInicio]
    )[0]?.total || 0

    const eventosActivos = query(
      `SELECT COUNT(*) as c FROM eventos WHERE estado = 'activo'`
    )[0]?.c || 0

    const clientesNuevosMes = query(
      `SELECT COUNT(*) as c FROM clientes WHERE fecha_registro >= ?`, [mesInicio]
    )[0]?.c || 0

    const cxcTotal = query(
      `SELECT COALESCE(SUM(saldo_pendiente),0) as total FROM participantes WHERE saldo_pendiente > 0`
    )[0]?.total || 0

    const saldoBancos = query(
      `SELECT COALESCE(SUM(saldo_actual),0) as total FROM cuentas_bancarias`
    )[0]?.total || 0

    setKpis({ ingresosMes, eventosActivos, clientesNuevosMes, cxcTotal, saldoBancos })

    // Ingresos por evento (últimos 5)
    const ie = query(`
      SELECT e.nombre,
        COALESCE(SUM(a.monto),0) as ingresos,
        e.costo_total as gastos
      FROM eventos e
      LEFT JOIN abonos a ON a.evento_id = e.id
      GROUP BY e.id
      ORDER BY e.fecha DESC LIMIT 5
    `)
    setIngresosEvento(ie.map(r => ({
      nombre: r.nombre.length > 22 ? r.nombre.slice(0,22)+'...' : r.nombre,
      Ingresos: Number(r.ingresos),
      Gastos: Number(r.gastos)
    })))

    // Evolución mensual (6 meses)
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = d.toISOString().slice(0,7)
      const label = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
      const ing = query(
        `SELECT COALESCE(SUM(monto),0) as t FROM abonos WHERE fecha LIKE ?`, [key+'%']
      )[0]?.t || 0
      const eg = query(
        `SELECT COALESCE(SUM(importe),0) as t FROM gastos WHERE fecha LIKE ?`, [key+'%']
      )[0]?.t || 0
      meses.push({ mes: label, Ingresos: Number(ing), Gastos: Number(eg) })
    }
    setEvolucionMensual(meses)

    // Gastos por categoría
    const gc = query(`
      SELECT categoria, SUM(importe) as total
      FROM gastos GROUP BY categoria ORDER BY total DESC
    `)
    setGastosCat(gc.map(r => ({ name: r.categoria, value: Number(r.total) })))

    // Próximos eventos
    const pe = query(`
      SELECT * FROM eventos WHERE estado = 'activo' ORDER BY fecha ASC LIMIT 4
    `)
    setEventosProximos(pe)

    // Clientes con saldo pendiente
    const cs = query(`
      SELECT p.nombre_cliente, SUM(p.saldo_pendiente) as deuda,
        e.nombre as evento, e.fecha
      FROM participantes p
      JOIN eventos e ON e.id = p.evento_id
      WHERE p.saldo_pendiente > 0
      GROUP BY p.nombre_cliente
      ORDER BY deuda DESC LIMIT 5
    `)
    setClientesSaldo(cs)

    // Pagos recientes
    const pr = query(`
      SELECT a.fecha, a.monto, a.referencia,
        p.nombre_cliente, e.nombre as evento
      FROM abonos a
      JOIN participantes p ON p.id = a.participante_id
      JOIN eventos e ON e.id = a.evento_id
      ORDER BY a.created_at DESC LIMIT 6
    `)
    setPagosRecientes(pr)
  }

  const tooltipStyle = {
    background: '#fff', border: '1px solid rgba(196,169,125,0.3)',
    borderRadius: 8, fontFamily: 'DM Sans', fontSize: 12
  }

  return (
    <div style={{ flex: 1 }}>
      <PageHeader
        title="Dashboard"
        subtitle={`Sendery Outdoor Lifestyle — ${new Date().toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`}
      />
      <PageContent>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
          <KPICard
            label="Ingresos del mes"
            value={formatMXN(kpis.ingresosMes)}
            sub="Suma de abonos recibidos"
            icon={<TrendingUp size={18} color="#2C3A1A" />}
            accent="#E8C547"
          />
          <KPICard
            label="Eventos activos"
            value={kpis.eventosActivos || 0}
            sub="Eventos en curso"
            icon={<CalendarDays size={18} color="#4A5E28" />}
            accent="#4A5E28"
          />
          <KPICard
            label="Clientes nuevos"
            value={kpis.clientesNuevosMes || 0}
            sub="Este mes"
            icon={<Users size={18} color="#2C3A1A" />}
            accent="#C4A97D"
          />
          <KPICard
            label="Cuentas por cobrar"
            value={formatMXN(kpis.cxcTotal)}
            sub="Saldo pendiente total"
            icon={<AlertCircle size={18} color="#8B1A1A" />}
            color="#8B1A1A"
            accent="#FCECEA"
          />
          <KPICard
            label="Saldo en bancos"
            value={formatMXN(kpis.saldoBancos)}
            sub="Total cuentas"
            icon={<Banknote size={18} color="#2C3A1A" />}
            accent="#EAF0D8"
          />
        </div>

        {/* Gráficas fila 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <Card title="Ingresos vs Gastos por Evento">
            <div style={{ padding: 16 }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ingresosEvento} margin={{ top: 4, right: 10, left: 0, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(196,169,125,0.2)" />
                  <XAxis
                    dataKey="nombre"
                    tick={{ fontSize: 9, fontFamily: 'DM Sans' }}
                    angle={-40}
                    textAnchor="end"
                    interval={0}
                    height={90}
                  />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'DM Sans' }} tickFormatter={v => '$'+Math.round(v/1000)+'k'} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => formatMXN(v)} />
                  <Legend wrapperStyle={{ fontFamily: 'DM Sans', fontSize: 11 }} />
                  <Bar dataKey="Ingresos" fill="#E8C547" radius={[4,4,0,0]} />
                  <Bar dataKey="Gastos" fill="#2C3A1A" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Evolución Mensual (6 meses)">
            <div style={{ padding: 16 }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={evolucionMensual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(196,169,125,0.2)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fontFamily: 'DM Sans' }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'DM Sans' }} tickFormatter={v => '$'+Math.round(v/1000)+'k'} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => formatMXN(v)} />
                  <Legend wrapperStyle={{ fontFamily: 'DM Sans', fontSize: 11 }} />
                  <Line type="monotone" dataKey="Ingresos" stroke="#E8C547" strokeWidth={2.5} dot={{ fill: '#E8C547', r: 4 }} />
                  <Line type="monotone" dataKey="Gastos" stroke="#2C3A1A" strokeWidth={2.5} dot={{ fill: '#2C3A1A', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Gráfica pie + próximos eventos */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginBottom: 24 }}>
          <Card title="Gastos por Categoría">
            <div style={{ padding: '16px 8px' }}>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                  <Pie
                    data={gastosCat}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent, x, y, midAngle }) => {
                      const RADIAN = Math.PI / 180
                      const radius = 85
                      const cx = x - Math.cos(-midAngle * RADIAN) * (radius - 0)
                      return (
                        <text
                          x={x} y={y}
                          fill="#2C3A1A"
                          textAnchor={x > 160 ? 'start' : 'end'}
                          dominantBaseline="central"
                          style={{ fontSize: 11, fontFamily: 'DM Sans', fontWeight: 500 }}
                        >
                          {`${name} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      )
                    }}
                    labelLine={{ stroke: '#C4A97D', strokeWidth: 1 }}
                  >
                    {gastosCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={v => formatMXN(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Próximos Eventos" headerActions={
            <button onClick={() => navigate('/eventos')} style={{
              background: 'none', border: 'none', color: '#4A5E28',
              fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}>Ver todos →</button>
          }>
            <div style={{ padding: '8px 0' }}>
              {eventosProximos.length === 0 ? (
                <div style={{ padding: '20px 20px', color: '#6B7B4F', fontSize: 13, fontFamily: 'DM Sans' }}>
                  Sin eventos activos
                </div>
              ) : eventosProximos.map(ev => {
                const est = getEventoStatus(ev.estado)
                return (
                  <div key={ev.id}
                    onClick={() => navigate(`/eventos/${ev.id}`)}
                    style={{
                      padding: '12px 20px', cursor: 'pointer',
                      borderBottom: '1px solid rgba(196,169,125,0.12)',
                      display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,94,40,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 40, height: 40, background: ev.tipo === 'caminata' ? '#EAF0D8' : '#FFF3CC',
                      borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0
                    }}>
                      {ev.tipo === 'caminata' ? '🥾' : '✈️'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, color: '#2C3A1A', marginBottom: 2 }}>
                        {ev.nombre}
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: '#6B7B4F', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={11} /> {formatDate(ev.fecha)}
                        </span>
                        <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: '#6B7B4F', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <MapPin size={11} /> {ev.lugar?.split(',')[0]}
                        </span>
                      </div>
                    </div>
                    <Badge label={est.label} bg={est.bg} color={est.color} />
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Tablas inferiores */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Saldos Pendientes por Cliente" headerActions={
            <button onClick={() => navigate('/clientes')} style={{
              background: 'none', border: 'none', color: '#4A5E28',
              fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}>Ver clientes →</button>
          }>
            <Table headers={['Cliente', 'Deuda']}>
              {clientesSaldo.length === 0
                ? <TR><TD style={{ textAlign: 'center', color: '#6B7B4F' }}>Sin saldos pendientes</TD></TR>
                : clientesSaldo.map((c, i) => {
                  const ps = getPaymentStatus(c.deuda, c.deuda + 1)
                  return (
                    <TR key={i}>
                      <TD>
                        <div style={{ fontWeight: 500 }}>{c.nombre_cliente}</div>
                        <div style={{ fontSize: 11, color: '#6B7B4F' }}>{c.evento}</div>
                      </TD>
                      <TD>
                        <Badge label={formatMXN(c.deuda)} bg={ps.bg} color={ps.color} />
                      </TD>
                    </TR>
                  )
                })}
            </Table>
          </Card>

          <Card title="Pagos Recientes">
            <Table headers={['Fecha', 'Cliente', 'Monto']}>
              {pagosRecientes.map((p, i) => (
                <TR key={i}>
                  <TD style={{ color: '#6B7B4F', fontSize: 12 }}>{formatDate(p.fecha)}</TD>
                  <TD>
                    <div style={{ fontWeight: 500 }}>{p.nombre_cliente}</div>
                    <div style={{ fontSize: 11, color: '#6B7B4F' }}>{p.evento}</div>
                  </TD>
                  <TD>
                    <span style={{ fontWeight: 600, color: '#2C3A1A' }}>{formatMXN(p.monto)}</span>
                  </TD>
                </TR>
              ))}
            </Table>
          </Card>
        </div>
      </PageContent>
    </div>
  )
}
