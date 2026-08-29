import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { supabase } from '../../lib/supabase.js'
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

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    const hoy = new Date().toISOString().split('T')[0]
    const mesInicio = hoy.slice(0, 7) + '-01'

    const [
      { data: abMes },
      { count: eventosActivos },
      { count: clientesNuevosMes },
      { data: partsSaldo },
      { data: cuentas },
      { data: eventos },
      { data: allAbonos },
      { data: allGastos },
      { data: gastosCatData },
      { data: eventosProx },
      { data: partsDeuda },
      { data: abonosRecientes }
    ] = await Promise.all([
      supabase.from('abonos').select('monto').gte('fecha', mesInicio),
      supabase.from('eventos').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
      supabase.from('clientes').select('*', { count: 'exact', head: true }).gte('fecha_registro', mesInicio),
      supabase.from('participantes').select('saldo_pendiente').gt('saldo_pendiente', 0),
      supabase.from('cuentas_bancarias').select('saldo_actual'),
      supabase.from('eventos').select('id, nombre, costo_total, fecha, abonos(monto)').order('fecha', { ascending: false }).limit(5),
      supabase.from('abonos').select('fecha, monto').gte('fecha', getMonthsAgo(5)),
      supabase.from('gastos').select('fecha, importe').gte('fecha', getMonthsAgo(5)),
      supabase.from('gastos').select('categoria, importe'),
      supabase.from('eventos').select('*').eq('estado', 'activo').order('fecha', { ascending: true }).limit(4),
      supabase.from('participantes').select('nombre_cliente, saldo_pendiente, eventos(nombre, fecha)').gt('saldo_pendiente', 0).order('saldo_pendiente', { ascending: false }).limit(5),
      supabase.from('abonos').select('fecha, monto, referencia, participantes(nombre_cliente), eventos(nombre)').order('created_at', { ascending: false }).limit(6)
    ])

    const ingresosMes = abMes?.reduce((s, a) => s + Number(a.monto), 0) || 0
    const cxcTotal = partsSaldo?.reduce((s, p) => s + Number(p.saldo_pendiente), 0) || 0
    const saldoBancos = cuentas?.reduce((s, c) => s + Number(c.saldo_actual), 0) || 0
    setKpis({ ingresosMes, eventosActivos: eventosActivos || 0, clientesNuevosMes: clientesNuevosMes || 0, cxcTotal, saldoBancos })

    // Ingresos por evento
    setIngresosEvento((eventos || []).map(e => ({
      nombre: e.nombre.length > 22 ? e.nombre.slice(0, 22) + '...' : e.nombre,
      Ingresos: (e.abonos || []).reduce((s, a) => s + Number(a.monto), 0),
      Gastos: Number(e.costo_total)
    })))

    // Evolución mensual (6 meses)
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = d.toISOString().slice(0, 7)
      const label = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
      const ing = (allAbonos || []).filter(a => a.fecha?.startsWith(key)).reduce((s, a) => s + Number(a.monto), 0)
      const eg = (allGastos || []).filter(g => g.fecha?.startsWith(key)).reduce((s, g) => s + Number(g.importe), 0)
      meses.push({ mes: label, Ingresos: ing, Gastos: eg })
    }
    setEvolucionMensual(meses)

    // Gastos por categoría
    const catMap = {}
    ;(gastosCatData || []).forEach(g => { catMap[g.categoria] = (catMap[g.categoria] || 0) + Number(g.importe) })
    setGastosCat(Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value))

    setEventosProximos(eventosProx || [])

    // Clientes con saldo pendiente
    const clienteMap = {}
    ;(partsDeuda || []).forEach(p => {
      const nombre = p.nombre_cliente
      if (!clienteMap[nombre]) clienteMap[nombre] = { nombre_cliente: nombre, deuda: 0, evento: p.eventos?.nombre, fecha: p.eventos?.fecha }
      clienteMap[nombre].deuda += Number(p.saldo_pendiente)
    })
    setClientesSaldo(Object.values(clienteMap).sort((a, b) => b.deuda - a.deuda).slice(0, 5))

    // Pagos recientes
    setPagosRecientes((abonosRecientes || []).map(a => ({
      fecha: a.fecha,
      monto: a.monto,
      referencia: a.referencia,
      nombre_cliente: a.participantes?.nombre_cliente,
      evento: a.eventos?.nombre
    })))
  }

  const tooltipStyle = {
    background: '#fff', border: '1px solid rgba(196,169,125,0.3)',
    borderRadius: 8, fontFamily: 'DM Sans', fontSize: 12
  }

  return (
    <div style={{ flex: 1 }}>
      <PageHeader
        title="Dashboard"
        subtitle={`Sendery Outdoor Lifestyle — ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
      />
      <PageContent>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
          <KPICard label="Ingresos del mes" value={formatMXN(kpis.ingresosMes)} sub="Suma de abonos recibidos" icon={<TrendingUp size={18} color="#2C3A1A" />} accent="#E8C547" />
          <KPICard label="Eventos activos" value={kpis.eventosActivos || 0} sub="Eventos en curso" icon={<CalendarDays size={18} color="#4A5E28" />} accent="#4A5E28" />
          <KPICard label="Clientes nuevos" value={kpis.clientesNuevosMes || 0} sub="Este mes" icon={<Users size={18} color="#2C3A1A" />} accent="#C4A97D" />
          <KPICard label="Cuentas por cobrar" value={formatMXN(kpis.cxcTotal)} sub="Saldo pendiente total" icon={<AlertCircle size={18} color="#8B1A1A" />} color="#8B1A1A" accent="#FCECEA" />
          <KPICard label="Saldo en bancos" value={formatMXN(kpis.saldoBancos)} sub="Total cuentas" icon={<Banknote size={18} color="#2C3A1A" />} accent="#EAF0D8" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <Card title="Ingresos vs Gastos por Evento">
            <div style={{ padding: 16 }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ingresosEvento} margin={{ top: 4, right: 10, left: 0, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(196,169,125,0.2)" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 9, fontFamily: 'DM Sans' }} angle={-40} textAnchor="end" interval={0} height={90} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'DM Sans' }} tickFormatter={v => '$' + Math.round(v / 1000) + 'k'} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => formatMXN(v)} />
                  <Legend wrapperStyle={{ fontFamily: 'DM Sans', fontSize: 11 }} />
                  <Bar dataKey="Ingresos" fill="#E8C547" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gastos" fill="#2C3A1A" radius={[4, 4, 0, 0]} />
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
                  <YAxis tick={{ fontSize: 10, fontFamily: 'DM Sans' }} tickFormatter={v => '$' + Math.round(v / 1000) + 'k'} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => formatMXN(v)} />
                  <Legend wrapperStyle={{ fontFamily: 'DM Sans', fontSize: 11 }} />
                  <Line type="monotone" dataKey="Ingresos" stroke="#E8C547" strokeWidth={2.5} dot={{ fill: '#E8C547', r: 4 }} />
                  <Line type="monotone" dataKey="Gastos" stroke="#2C3A1A" strokeWidth={2.5} dot={{ fill: '#2C3A1A', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginBottom: 24 }}>
          <Card title="Gastos por Categoría">
            <div style={{ padding: '16px 8px' }}>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                  <Pie data={gastosCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                    label={({ name, percent, x, y }) => (
                      <text x={x} y={y} fill="#2C3A1A" textAnchor={x > 160 ? 'start' : 'end'} dominantBaseline="central"
                        style={{ fontSize: 11, fontFamily: 'DM Sans', fontWeight: 500 }}>
                        {`${name} ${(percent * 100).toFixed(0)}%`}
                      </text>
                    )}
                    labelLine={{ stroke: '#C4A97D', strokeWidth: 1 }}>
                    {gastosCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={v => formatMXN(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Próximos Eventos" headerActions={
            <button onClick={() => navigate('/eventos')} style={{ background: 'none', border: 'none', color: '#4A5E28', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ver todos →</button>
          }>
            <div style={{ padding: '8px 0' }}>
              {eventosProximos.length === 0 ? (
                <div style={{ padding: '20px 20px', color: '#6B7B4F', fontSize: 13, fontFamily: 'DM Sans' }}>Sin eventos activos</div>
              ) : eventosProximos.map(ev => {
                const est = getEventoStatus(ev.estado)
                return (
                  <div key={ev.id} onClick={() => navigate(`/eventos/${ev.id}`)}
                    style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(196,169,125,0.12)', display: 'flex', alignItems: 'center', gap: 12, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,94,40,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 40, height: 40, background: ev.tipo === 'caminata' ? '#EAF0D8' : '#FFF3CC', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {ev.tipo === 'caminata' ? '🥾' : '✈️'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, color: '#2C3A1A', marginBottom: 2 }}>{ev.nombre}</div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: '#6B7B4F', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> {formatDate(ev.fecha)}</span>
                        <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: '#6B7B4F', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} /> {ev.lugar?.split(',')[0]}</span>
                      </div>
                    </div>
                    <Badge label={est.label} bg={est.bg} color={est.color} />
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Saldos Pendientes por Cliente" headerActions={
            <button onClick={() => navigate('/clientes')} style={{ background: 'none', border: 'none', color: '#4A5E28', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ver clientes →</button>
          }>
            <Table headers={['Cliente', 'Deuda']}>
              {clientesSaldo.length === 0
                ? <TR><TD style={{ textAlign: 'center', color: '#6B7B4F' }}>Sin saldos pendientes</TD></TR>
                : clientesSaldo.map((c, i) => {
                  const ps = getPaymentStatus(c.deuda, c.deuda + 1)
                  return (
                    <TR key={i}>
                      <TD><div style={{ fontWeight: 500 }}>{c.nombre_cliente}</div><div style={{ fontSize: 11, color: '#6B7B4F' }}>{c.evento}</div></TD>
                      <TD><Badge label={formatMXN(c.deuda)} bg={ps.bg} color={ps.color} /></TD>
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
                  <TD><div style={{ fontWeight: 500 }}>{p.nombre_cliente}</div><div style={{ fontSize: 11, color: '#6B7B4F' }}>{p.evento}</div></TD>
                  <TD><span style={{ fontWeight: 600, color: '#2C3A1A' }}>{formatMXN(p.monto)}</span></TD>
                </TR>
              ))}
            </Table>
          </Card>
        </div>
      </PageContent>
    </div>
  )
}

function getMonthsAgo(n) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().split('T')[0]
}
