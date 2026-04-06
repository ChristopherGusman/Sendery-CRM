import React, { useState, useEffect } from 'react'
import { query } from '../../db/database.js'
import { formatMXN, formatDate } from '../../utils/format.js'
import {
  PageHeader, PageContent, Card, Btn, Badge, Select, FormField
} from '../../components/Layout.jsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { generarReporteEvento, generarEstadoResultados } from './pdfGenerator.js'
import { FileText, Download, TrendingUp, TrendingDown } from 'lucide-react'

const COLORS_PIE = ['#2C3A1A','#4A5E28','#E8C547','#C4A97D','#6B7B4F','#8B9E5A']

export default function Reportes() {
  const [tab, setTab] = useState('resultados')
  const [eventos, setEventos] = useState([])
  const [eventoSel, setEventoSel] = useState('')
  const [periodoAnio, setPeriodoAnio] = useState(new Date().getFullYear().toString())
  const [periodoMes, setPeriodoMes] = useState('')
  const [resultados, setResultados] = useState(null)
  const [eventoData, setEventoData] = useState(null)
  const [gastosCat, setGastosCat] = useState([])

  useEffect(() => {
    const evs = query(`SELECT id, nombre, fecha FROM eventos ORDER BY fecha DESC`)
    setEventos(evs)
    if (evs.length > 0) setEventoSel(String(evs[0].id))
    calcResultados(new Date().getFullYear().toString(), '')
    calcGastosCat()
  }, [])

  function calcResultados(anio, mes) {
    const filtro = mes ? `${anio}-${mes}` : anio
    const likeStr = mes ? `${filtro}%` : `${filtro}-%`

    const abonos = query(`SELECT a.monto, e.nombre as evento FROM abonos a JOIN eventos e ON e.id=a.evento_id WHERE a.fecha LIKE ?`, [likeStr])
    const gastos = query(`SELECT importe, categoria FROM gastos WHERE fecha LIKE ?`, [likeStr])
    const totalIng = abonos.reduce((s, a) => s + Number(a.monto), 0)
    const totalGas = gastos.reduce((s, g) => s + Number(g.importe), 0)
    const util = totalIng - totalGas

    // Ingresos por evento
    const ingEvMap = {}
    abonos.forEach(a => { ingEvMap[a.evento] = (ingEvMap[a.evento] || 0) + Number(a.monto) })
    const ingDetalle = Object.entries(ingEvMap).map(([label, valor]) => ({ label, valor }))

    // Gastos por categoría
    const gasMap = {}
    gastos.forEach(g => { gasMap[g.categoria] = (gasMap[g.categoria] || 0) + Number(g.importe) })
    const gasDetalle = Object.entries(gasMap).map(([label, valor]) => ({ label, valor }))

    setResultados({ totalIng, totalGas, util, ingDetalle, gasDetalle })
  }

  function calcGastosCat() {
    const rows = query(`SELECT categoria, SUM(importe) as total FROM gastos GROUP BY categoria ORDER BY total DESC`)
    setGastosCat(rows.map(r => ({ name: r.categoria, value: Number(r.total) })))
  }

  function loadEventoData(eid) {
    if (!eid) return
    const ev = query(`SELECT * FROM eventos WHERE id=?`, [eid])[0]
    const partsRaw = query(`SELECT * FROM participantes WHERE evento_id=?`, [eid])
    const parts = partsRaw.map(p => ({
      ...p,
      abonos: query(`SELECT * FROM abonos WHERE participante_id=?`, [p.id])
    }))
    const gastos = query(`
      SELECT g.*, pr.nombre as proveedor_nombre FROM gastos g
      LEFT JOIN proveedores pr ON pr.id=g.proveedor_id
      WHERE g.evento_id=?
    `, [eid])
    setEventoData({ ev, parts, gastos })
  }

  useEffect(() => { if (eventoSel) loadEventoData(eventoSel) }, [eventoSel])
  useEffect(() => { calcResultados(periodoAnio, periodoMes) }, [periodoAnio, periodoMes])

  const MESES = ['01','02','03','04','05','06','07','08','09','10','11','12']
  const MESES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  const chartData = MESES.map((m, i) => {
    const likeStr = `${periodoAnio}-${m}%`
    const ing = query(`SELECT COALESCE(SUM(monto),0) as t FROM abonos WHERE fecha LIKE ?`, [likeStr])[0]?.t || 0
    const gas = query(`SELECT COALESCE(SUM(importe),0) as t FROM gastos WHERE fecha LIKE ?`, [likeStr])[0]?.t || 0
    return { mes: MESES_LABEL[i], Ingresos: Number(ing), Gastos: Number(gas) }
  })

  const tooltipStyle = { background: '#fff', border: '1px solid rgba(196,169,125,0.3)', borderRadius: 8, fontFamily: 'DM Sans', fontSize: 12 }

  const TABS = [
    { id: 'resultados', label: '📊 Estado de Resultados' },
    { id: 'evento', label: '🥾 Reporte por Evento' },
    { id: 'flujo', label: '💵 Flujo de Efectivo' }
  ]

  return (
    <div style={{ flex: 1 }}>
      <PageHeader title="Reportes" subtitle="Análisis financiero y generación de documentos PDF" />
      <PageContent>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid rgba(196,169,125,0.2)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '10px 20px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'DM Sans', fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? '#2C3A1A' : '#6B7B4F',
              borderBottom: tab === t.id ? '3px solid #E8C547' : '3px solid transparent',
              marginBottom: -2, transition: 'all 0.15s'
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── Tab Estado de Resultados ── */}
        {tab === 'resultados' && resultados && (
          <div>
            {/* Filtros de período */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
              <FormField label="Año">
                <Select value={periodoAnio} onChange={e => setPeriodoAnio(e.target.value)} style={{ width: 100 }}>
                  {['2024','2025','2026'].map(y => <option key={y} value={y}>{y}</option>)}
                </Select>
              </FormField>
              <FormField label="Mes (opcional)">
                <Select value={periodoMes} onChange={e => setPeriodoMes(e.target.value)} style={{ width: 150 }}>
                  <option value="">Año completo</option>
                  {MESES.map((m, i) => <option key={m} value={m}>{MESES_LABEL[i]}</option>)}
                </Select>
              </FormField>
              <Btn
                icon={<Download size={14}/>}
                variant="secondary"
                onClick={() => generarEstadoResultados(
                  `${periodoMes ? MESES_LABEL[parseInt(periodoMes)-1]+' ' : ''}${periodoAnio}`,
                  resultados.totalIng, resultados.totalGas, resultados.util,
                  { ingresos: resultados.ingDetalle, gastos: resultados.gasDetalle }
                )}>
                Exportar PDF
              </Btn>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total Ingresos', val: resultados.totalIng, color: '#2C3A1A', bg: '#EAF0D8', icon: <TrendingUp size={20} color="#4A5E28"/> },
                { label: 'Total Gastos', val: resultados.totalGas, color: '#8B1A1A', bg: '#FCECEA', icon: <TrendingDown size={20} color="#8B1A1A"/> },
                { label: resultados.util >= 0 ? 'Utilidad Neta' : 'Pérdida Neta', val: resultados.util, color: resultados.util >= 0 ? '#2C3A1A' : '#8B1A1A', bg: resultados.util >= 0 ? '#EAF0D8' : '#FCECEA', icon: '💰' }
              ].map(({ label, val, color, bg, icon }) => (
                <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '20px', border: '1px solid rgba(196,169,125,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: '#6B7B4F', fontWeight: 600 }}>{label}</span>
                    <div style={{ background: bg, borderRadius: 8, padding: 6 }}>{icon}</div>
                  </div>
                  <div style={{ fontFamily: 'Oswald', fontSize: 28, fontWeight: 700, color }}>{formatMXN(val)}</div>
                </div>
              ))}
            </div>

            {/* Gráfica mensual */}
            <Card title={`Evolución mensual ${periodoAnio}`} style={{ marginBottom: 24 }}>
              <div style={{ padding: 20 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(196,169,125,0.2)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                    <YAxis tick={{ fontSize: 11, fontFamily: 'DM Sans' }} tickFormatter={v => '$'+Math.round(v/1000)+'k'} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => formatMXN(v)} />
                    <Legend wrapperStyle={{ fontFamily: 'DM Sans', fontSize: 12 }} />
                    <Bar dataKey="Ingresos" fill="#E8C547" radius={[4,4,0,0]} />
                    <Bar dataKey="Gastos" fill="#2C3A1A" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Detalle ingresos + gastos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card title="Ingresos por Evento">
                <div style={{ padding: '8px 0' }}>
                  {resultados.ingDetalle.length === 0 ? (
                    <div style={{ padding: '16px 20px', color: '#6B7B4F', fontFamily: 'DM Sans', fontSize: 13 }}>Sin ingresos en el período</div>
                  ) : resultados.ingDetalle.map(({ label, valor }) => (
                    <div key={label} style={{ padding: '10px 20px', borderBottom: '1px solid rgba(196,169,125,0.1)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'DM Sans', fontSize: 13, color: '#2C3A1A' }}>{label}</span>
                      <span style={{ fontFamily: 'Oswald', fontSize: 14, fontWeight: 700, color: '#4A5E28' }}>{formatMXN(valor)}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Gastos por Categoría">
                <div style={{ padding: 16 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={gastosCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                        {gastosCat.map((_, i) => <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={v => formatMXN(v)} />
                      <Legend wrapperStyle={{ fontFamily: 'DM Sans', fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ── Tab Reporte por Evento ── */}
        {tab === 'evento' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
              <FormField label="Seleccionar evento" style={{ flex: 1 }}>
                <Select value={eventoSel} onChange={e => setEventoSel(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {eventos.map(e => <option key={e.id} value={e.id}>{e.nombre} ({formatDate(e.fecha)})</option>)}
                </Select>
              </FormField>
              {eventoData && (
                <Btn icon={<Download size={14}/>} variant="secondary"
                  onClick={() => generarReporteEvento(eventoData.ev, eventoData.parts, eventoData.gastos)}>
                  Exportar PDF
                </Btn>
              )}
            </div>

            {eventoData && (
              <div>
                {/* Resumen */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 14, marginBottom: 20 }}>
                  {(() => {
                    const totalAc = eventoData.parts.reduce((s, p) => s + Number(p.monto_total_acordado), 0)
                    const totalAb = eventoData.parts.reduce((s, p) => s + p.abonos.reduce((a, b) => a + Number(b.monto), 0), 0)
                    const totalSal = eventoData.parts.reduce((s, p) => s + Number(p.saldo_pendiente), 0)
                    const totalGas = eventoData.gastos.reduce((s, g) => s + Number(g.importe), 0)
                    const util = totalAb - totalGas
                    return [
                      { l: 'Participantes', v: eventoData.parts.length, fmt: false },
                      { l: 'Total acordado', v: totalAc, fmt: true, color: '#2C3A1A' },
                      { l: 'Total cobrado', v: totalAb, fmt: true, color: '#4A5E28' },
                      { l: 'Por cobrar', v: totalSal, fmt: true, color: totalSal > 0 ? '#8B1A1A' : '#4A5E28' },
                      { l: 'Total gastos', v: totalGas, fmt: true, color: '#8B1A1A' },
                      { l: 'Utilidad', v: util, fmt: true, color: util >= 0 ? '#2C3A1A' : '#8B1A1A' }
                    ].map(({ l, v, fmt, color }) => (
                      <div key={l} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(196,169,125,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#6B7B4F', fontFamily: 'DM Sans', marginBottom: 4 }}>{l}</div>
                        <div style={{ fontFamily: 'Oswald', fontSize: 18, fontWeight: 700, color: color || '#2C3A1A' }}>
                          {fmt ? formatMXN(v) : v}
                        </div>
                      </div>
                    ))
                  })()}
                </div>

                {/* Lista participantes */}
                <Card title="Participantes" style={{ marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'DM Sans', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#2C3A1A' }}>
                        {['Participante','Total acordado','Abonado','Saldo','Estado','Acción'].map(h => (
                          <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#E8C547', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {eventoData.parts.map((p, i) => {
                        const ab = p.abonos.reduce((a, b) => a + Number(b.monto), 0)
                        const s = Number(p.saldo_pendiente)
                        const est = s <= 0 ? { label: 'Liquidado', bg: '#EAF0D8', color: '#2C3A1A' } :
                          ab > 0 ? { label: 'Parcial', bg: '#FFF3CC', color: '#7A5A00' } :
                          { label: 'Sin pago', bg: '#FCECEA', color: '#8B1A1A' }
                        return (
                          <tr key={p.id} style={{ background: i % 2 === 1 ? 'rgba(245,240,232,0.5)' : 'transparent', borderBottom: '1px solid rgba(196,169,125,0.1)' }}>
                            <td style={{ padding: '9px 14px', fontWeight: 500 }}>{p.nombre_cliente}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right' }}>{formatMXN(p.monto_total_acordado)}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', color: '#4A5E28', fontWeight: 600 }}>{formatMXN(ab)}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', color: s > 0 ? '#8B1A1A' : '#4A5E28', fontWeight: 600 }}>{formatMXN(s)}</td>
                            <td style={{ padding: '9px 14px' }}><Badge label={est.label} bg={est.bg} color={est.color} /></td>
                            <td style={{ padding: '9px 14px' }}>
                              <button onClick={() => { const { generarReciboEvento } = require('../Reportes/pdfGenerator.js'); generarReciboEvento(eventoData.ev, p, p.abonos) }}
                                style={{ background: 'none', border: '1px solid rgba(196,169,125,0.4)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#4A5E28', fontFamily: 'DM Sans', fontSize: 12 }}>
                                <FileText size={12}/> Recibo
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ── Tab Flujo de Efectivo ── */}
        {tab === 'flujo' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
              <FormField label="Año">
                <Select value={periodoAnio} onChange={e => setPeriodoAnio(e.target.value)} style={{ width: 100 }}>
                  {['2024','2025','2026'].map(y => <option key={y} value={y}>{y}</option>)}
                </Select>
              </FormField>
            </div>

            {(() => {
              const cuentas = query(`SELECT * FROM cuentas_bancarias`)
              const filas = MESES.map((m, i) => {
                const likeStr = `${periodoAnio}-${m}%`
                const ing = query(`SELECT COALESCE(SUM(monto),0) as t FROM abonos WHERE fecha LIKE ?`, [likeStr])[0]?.t || 0
                const gas = query(`SELECT COALESCE(SUM(importe),0) as t FROM gastos WHERE fecha LIKE ?`, [likeStr])[0]?.t || 0
                return { mes: MESES_LABEL[i], Ingresos: Number(ing), Gastos: Number(gas), Neto: Number(ing) - Number(gas) }
              })
              const totalIng = filas.reduce((s, r) => s + r.Ingresos, 0)
              const totalGas = filas.reduce((s, r) => s + r.Gastos, 0)
              const totalNeto = totalIng - totalGas

              return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
                    {[
                      { l: 'Flujo de entrada', v: totalIng, color: '#4A5E28' },
                      { l: 'Flujo de salida', v: totalGas, color: '#8B1A1A' },
                      { l: 'Flujo neto', v: totalNeto, color: totalNeto >= 0 ? '#2C3A1A' : '#8B1A1A' }
                    ].map(({ l, v, color }) => (
                      <div key={l} style={{ background: '#fff', borderRadius: 12, padding: '18px', border: '1px solid rgba(196,169,125,0.2)' }}>
                        <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: '#6B7B4F', marginBottom: 6 }}>{l}</div>
                        <div style={{ fontFamily: 'Oswald', fontSize: 26, fontWeight: 700, color }}>{formatMXN(v)}</div>
                      </div>
                    ))}
                  </div>

                  <Card title={`Flujo de efectivo mensual — ${periodoAnio}`} style={{ marginBottom: 20 }}>
                    <div style={{ padding: 16 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'DM Sans', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#2C3A1A' }}>
                            {['Mes','Ingresos','Gastos','Flujo Neto'].map(h => (
                              <th key={h} style={{ padding: '9px 14px', textAlign: h !== 'Mes' ? 'right' : 'left', color: '#E8C547', fontSize: 11 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filas.map((f, i) => (
                            <tr key={f.mes} style={{ background: i % 2 === 1 ? 'rgba(245,240,232,0.5)' : '#fff', borderBottom: '1px solid rgba(196,169,125,0.1)' }}>
                              <td style={{ padding: '8px 14px', fontWeight: 500 }}>{f.mes}</td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', color: '#4A5E28', fontWeight: 600 }}>{f.Ingresos > 0 ? formatMXN(f.Ingresos) : '—'}</td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', color: '#8B1A1A', fontWeight: 600 }}>{f.Gastos > 0 ? formatMXN(f.Gastos) : '—'}</td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: f.Neto >= 0 ? '#2C3A1A' : '#8B1A1A' }}>
                                {f.Ingresos > 0 || f.Gastos > 0 ? formatMXN(f.Neto) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#2C3A1A' }}>
                            <td style={{ padding: '9px 14px', color: '#E8C547', fontWeight: 700 }}>TOTAL {periodoAnio}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', color: '#E8C547', fontWeight: 700 }}>{formatMXN(totalIng)}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', color: '#E8C547', fontWeight: 700 }}>{formatMXN(totalGas)}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', color: '#E8C547', fontWeight: 700, fontSize: 15 }}>{formatMXN(totalNeto)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </Card>

                  <Card title="Saldos actuales por cuenta">
                    <div style={{ padding: '8px 0' }}>
                      {cuentas.map(c => (
                        <div key={c.id} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(196,169,125,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, color: '#2C3A1A' }}>
                              {c.banco} ···{c.ultimos_4}
                            </div>
                            <div style={{ fontSize: 11, color: '#6B7B4F', fontFamily: 'DM Sans' }}>{c.tipo} · {c.titular}</div>
                          </div>
                          <div style={{ fontFamily: 'Oswald', fontSize: 20, fontWeight: 700, color: '#2C3A1A' }}>
                            {formatMXN(c.saldo_actual)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )
            })()}
          </div>
        )}
      </PageContent>
    </div>
  )
}
