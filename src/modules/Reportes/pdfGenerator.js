// ═══════════════════════════════════════════════════════════════
// SENDERY CRM — Generador de PDFs con jsPDF
// Todos los documentos llevan: Logo (texto), folio, marca Sendery
// ═══════════════════════════════════════════════════════════════

import { formatMXN, formatDateLong, formatDate, generateFolio } from '../../utils/format.js'

// ── Colores de marca ────────────────────────────────────────────
const C = {
  forest: [44, 58, 26],
  olive: [74, 94, 40],
  sun: [232, 197, 71],
  sand: [196, 169, 125],
  cream: [245, 240, 232],
  white: [255, 255, 255],
  red: [139, 26, 26],
  gray: [107, 123, 79]
}

async function getJsPDF() {
  if (window.jspdf) return window.jspdf.jsPDF
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
  return window.jspdf.jsPDF
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src; s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}

// ── Header de marca común ───────────────────────────────────────
function drawHeader(doc, folio) {
  const W = doc.internal.pageSize.getWidth()

  // Fondo amarillo sol
  doc.setFillColor(...C.sun)
  doc.rect(0, 0, W, 38, 'F')

  // Logo texto SENDERY en verde oscuro
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...C.forest)
  doc.text('SENDERY', 14, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C.forest)
  doc.text('OUTDOOR LIFESTYLE®', 14, 25)
  doc.text('Ensenada, Baja California, México', 14, 32)

  // Folio en esquina en verde oscuro
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...C.forest)
  doc.text(`FOLIO: ${folio}`, W - 14, 18, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...C.forest)
  doc.text(new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' }), W - 14, 25, { align: 'right' })

  // Línea verde oscuro
  doc.setDrawColor(...C.forest)
  doc.setLineWidth(0.8)
  doc.line(0, 38, W, 38)
}

function drawFooter(doc) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  doc.setFillColor(...C.forest)
  doc.rect(0, H - 14, W, 14, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...C.sand)
  doc.text('Sendery Outdoor Lifestyle® · Ensenada, BC · Sistema CRM v1.0', W / 2, H - 5, { align: 'center' })
}

// ── Carga logo desde /sendery-logo.png ─────────────────────────
let _logoData = undefined  // undefined = no intentado, null = fallido, string = dataURL
async function loadLogoBase64() {
  if (_logoData !== undefined) return _logoData
  try {
    const res = await fetch('/sendery-logo.png')
    if (!res.ok) { _logoData = null; return null }
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => { _logoData = reader.result; resolve(_logoData) }
      reader.onerror = () => { _logoData = null; resolve(null) }
      reader.readAsDataURL(blob)
    })
  } catch {
    _logoData = null
    return null
  }
}

function drawLogoText(doc, x, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...C.forest)
  doc.text('SENDERY', x, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.forest)
  doc.text('OUTDOOR LIFESTYLE®', x, y + 7)
  doc.text('Ensenada, B.C., México', x, y + 13)
}

// ── Recibo por abono individual ─────────────────────────────────
export async function generarReciboPorAbono(evento, participante, abono, moneda = 'MXN') {
  const jsPDF = await getJsPDF()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const folio = generateFolio('RCB')
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // ── HEADER amarillo ──────────────────────────────────────────
  const headerH = 50
  doc.setFillColor(...C.sun)
  doc.rect(0, 0, W, headerH, 'F')

  // Logo (imagen o texto de respaldo)
  const logoData = await loadLogoBase64()
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', 10, 7, 38, 36) } catch { drawLogoText(doc, 14, 20) }
  } else {
    drawLogoText(doc, 14, 20)
  }

  // Fecha y folio — columna derecha en verde oscuro
  const fechaHoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.forest)
  doc.text('FECHA:', W - 62, 22)
  doc.setFont('helvetica', 'normal')
  doc.text(fechaHoy, W - 14, 22, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.text('FOLIO:', W - 62, 33)
  doc.setFont('helvetica', 'normal')
  doc.text(folio, W - 14, 33, { align: 'right' })

  // Línea separadora verde oscuro
  doc.setDrawColor(...C.forest)
  doc.setLineWidth(1)
  doc.line(0, headerH, W, headerH)

  // ── TÍTULO ──────────────────────────────────────────────────
  let y = headerH + 24
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(34)
  doc.setTextColor(...C.forest)
  doc.text('R E C I B O', W / 2, y, { align: 'center' })

  // ── CUERPO ──────────────────────────────────────────────────
  const LX = 24          // margen izquierdo del label
  const VX = LX + 60    // posición del valor (alineado)
  const FS = 11          // font-size cuerpo
  const LH = 15          // line height
  y += 22

  const bodyLine = (label, value) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FS)
    doc.setTextColor(...C.forest)
    doc.text(label, LX, y)
    doc.setFont('helvetica', 'normal')
    // truncar si el valor es muy largo
    const maxW = W - VX - 16
    const txt = doc.splitTextToSize(value, maxW)[0] || value
    doc.text(txt, VX, y)
    y += LH
  }

  // RECIBO DE:
  bodyLine('RECIBO DE:', participante.nombre_cliente.toUpperCase())

  // LA CANTIDAD DE:
  const monto = Number(abono.monto)
  const montoStr = moneda === 'USD'
    ? `$${monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
    : `$${monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PESOS`
  bodyLine('LA CANTIDAD DE:', montoStr)

  // POR CONCEPTO DE:
  bodyLine('POR CONCEPTO DE:', evento.nombre.toUpperCase())

  // FECHA DE EVENTO:
  bodyLine('FECHA DE EVENTO:', formatDateLong(evento.fecha).toUpperCase())

  // REFERENCIA (opcional)
  if (abono.referencia) {
    bodyLine('REFERENCIA:', abono.referencia.toUpperCase())
  }

  // CUENTA DESTINO (opcional)
  if (abono.cuenta_destino) {
    bodyLine('CUENTA DESTINO:', abono.cuenta_destino.toUpperCase())
  }

  // ── Línea decorativa ────────────────────────────────────────
  y += 10
  doc.setDrawColor(...C.sand)
  doc.setLineWidth(0.35)
  doc.line(LX, y, W - LX, y)

  // ── FIRMAS ──────────────────────────────────────────────────
  const sigY = H - 52
  const sigW = 72
  doc.setLineWidth(0.6)
  doc.setDrawColor(...C.forest)

  // Firma izquierda
  doc.line(LX, sigY, LX + sigW, sigY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...C.forest)
  doc.text('FIRMA AUTORIZADA', LX + sigW / 2, sigY + 6, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...C.gray)
  doc.text('Sendery Outdoor Lifestyle®', LX + sigW / 2, sigY + 11, { align: 'center' })

  // Firma derecha
  const sigRX = W - LX - sigW
  doc.line(sigRX, sigY, sigRX + sigW, sigY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...C.forest)
  doc.text('FIRMA DE CONFORMIDAD', sigRX + sigW / 2, sigY + 6, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...C.gray)
  const clienteLabel = participante.nombre_cliente.length > 22
    ? participante.nombre_cliente.slice(0, 22) + '…'
    : participante.nombre_cliente
  doc.text(clienteLabel, sigRX + sigW / 2, sigY + 11, { align: 'center' })

  drawFooter(doc)

  const safeName = participante.nombre_cliente.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_').slice(0, 20)
  doc.save(`Recibo_${safeName}_${folio}.pdf`)
}

// ── Recibo por cliente (historial completo) ─────────────────────
export async function generarReciboEvento(evento, participante, abonos) {
  const jsPDF = await getJsPDF()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const folio = generateFolio('RCB')
  const W = doc.internal.pageSize.getWidth()

  drawHeader(doc, folio)

  let y = 48

  // Título
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...C.forest)
  doc.text('RECIBO DE PAGO', W / 2, y, { align: 'center' })
  y += 12

  // Datos del evento
  doc.setFillColor(...C.cream)
  doc.roundedRect(14, y, W - 28, 30, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...C.gray)
  doc.text('EVENTO', 20, y + 7)
  doc.text('FECHA', 108, y + 7)
  doc.text('LUGAR', 148, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...C.forest)
  // Columna evento: x=20 a x=106 (~86mm) → máx ~40 chars a 9pt
  const nombreCorto = evento.nombre.length > 38 ? evento.nombre.slice(0,38)+'…' : evento.nombre
  doc.text(nombreCorto, 20, y + 15)
  doc.text(formatDate(evento.fecha), 108, y + 15)
  // Columna lugar: x=148 a W-16 (~54mm) → máx ~26 chars a 9pt
  const lugarCorto = (evento.lugar||'').length > 25 ? (evento.lugar||'').slice(0,25)+'…' : (evento.lugar||'')
  doc.text(lugarCorto, 148, y + 15)

  // Tipo badge — ancho fijo generoso para que CAMINATA y VIAJE quepan sin recorte
  const tipoLabel = evento.tipo.toUpperCase()
  const badgeW = 22  // 22mm es suficiente para "CAMINATA" a 7pt
  doc.setFillColor(...C.olive)
  doc.roundedRect(20, y + 18, badgeW, 7, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...C.white)
  doc.text(tipoLabel, 20 + badgeW / 2, y + 23, { align: 'center' })
  y += 40

  // Datos del participante
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...C.forest)
  doc.text('DATOS DEL CLIENTE', 14, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...C.forest)
  doc.text(`Nombre:   ${participante.nombre_cliente}`, 14, y)
  y += 6
  if (participante.cuenta_destino_pago) {
    doc.text(`Cuenta destino:   ${participante.cuenta_destino_pago}`, 14, y)
    y += 6
  }
  y += 4

  // Tabla de abonos
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('DESGLOSE DE ABONOS', 14, y)
  y += 4

  const abonoRows = abonos.map(a => [
    formatDate(a.fecha),
    a.referencia || '—',
    a.cuenta_destino || '—',
    formatMXN(a.monto)
  ])

  doc.autoTable({
    startY: y,
    head: [['Fecha', 'Referencia', 'Cuenta Destino', 'Monto']],
    body: abonoRows,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: C.forest, textColor: C.sun, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 248, 244] },
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
    theme: 'grid'
  })

  y = doc.lastAutoTable.finalY + 8

  // Resumen financiero
  const totalAbonado = abonos.reduce((s, a) => s + Number(a.monto), 0)
  const saldo = Number(participante.saldo_pendiente)
  const total = Number(participante.monto_total_acordado)

  doc.setFillColor(...C.cream)
  doc.roundedRect(W / 2 + 10, y, W / 2 - 24, 32, 3, 3, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...C.gray)
  doc.text('Total acordado:', W / 2 + 14, y + 8)
  doc.text('Total abonado:', W / 2 + 14, y + 16)
  doc.text('Saldo pendiente:', W / 2 + 14, y + 24)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.forest)
  doc.text(formatMXN(total), W - 16, y + 8, { align: 'right' })
  doc.text(formatMXN(totalAbonado), W - 16, y + 16, { align: 'right' })

  if (saldo <= 0) {
    doc.setTextColor(...C.olive)
    doc.text('LIQUIDADO ✓', W - 16, y + 24, { align: 'right' })
  } else {
    doc.setTextColor(...C.red)
    doc.text(formatMXN(saldo), W - 16, y + 24, { align: 'right' })
  }

  y += 40

  // Sello LIQUIDADO — centrado en el área de resumen, acotado al ancho de página
  if (saldo <= 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(28)
    doc.setTextColor(...C.olive)
    doc.setGState(new doc.GState({ opacity: 0.12 }))
    // Clipping para que no salga del margen
    doc.saveGraphicsState && doc.saveGraphicsState()
    doc.text('LIQUIDADO', W / 2, y - 14, { align: 'center', angle: -12 })
    doc.setGState(new doc.GState({ opacity: 1 }))
  }

  y += 16

  // Firma
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C.gray)
  doc.line(14, y + 12, 80, y + 12)
  doc.text('Firma del responsable', 14, y + 18)
  doc.text('Sendery Outdoor Lifestyle®', 14, y + 24)

  doc.line(W - 80, y + 12, W - 14, y + 12)
  doc.text('Firma de conformidad del cliente', W - 14, y + 18, { align: 'right' })

  drawFooter(doc)
  doc.save(`Recibo_${participante.nombre_cliente.replace(/\s+/g,'_')}_${folio}.pdf`)
}

// ── Reporte de evento ───────────────────────────────────────────
export async function generarReporteEvento(evento, participantes, gastos) {
  const jsPDF = await getJsPDF()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const folio = generateFolio('RPT')
  const W = doc.internal.pageSize.getWidth()

  drawHeader(doc, folio)

  let y = 48

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...C.forest)
  doc.text('REPORTE DE EVENTO', W / 2, y, { align: 'center' })
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(evento.nombre, W / 2, y, { align: 'center' })
  y += 12

  // Info del evento
  doc.setFillColor(...C.cream)
  doc.roundedRect(14, y, W - 28, 22, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...C.gray)
  const labels = ['TIPO', 'FECHA', 'LUGAR', 'EJECUTOR', 'CUPO']
  const vals = [evento.tipo.toUpperCase(), formatDate(evento.fecha), evento.lugar || '—', evento.ejecutor, `${participantes.length}/${evento.cupo_maximo || '∞'}`]
  labels.forEach((l, i) => {
    const x = 20 + i * 38
    doc.text(l, x, y + 7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...C.forest)
    doc.text(vals[i], x, y + 14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...C.gray)
  })
  y += 30

  // Tabla participantes
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...C.forest)
  doc.text('PARTICIPANTES Y PAGOS', 14, y)
  y += 4

  const totalAbonado = participantes.reduce((s, p) => {
    const ab = (p.abonos || []).reduce((a, b) => a + Number(b.monto), 0)
    return s + ab
  }, 0)
  const totalAcordado = participantes.reduce((s, p) => s + Number(p.monto_total_acordado), 0)
  const totalSaldo = participantes.reduce((s, p) => s + Number(p.saldo_pendiente), 0)

  doc.autoTable({
    startY: y,
    head: [['Participante', 'Total acordado', 'Abonado', 'Saldo', 'Estado']],
    body: participantes.map(p => {
      const ab = (p.abonos || []).reduce((a, b) => a + Number(b.monto), 0)
      const s = Number(p.saldo_pendiente)
      const est = s <= 0 ? 'Liquidado' : ab > 0 ? 'Parcial' : 'Sin pago'
      return [p.nombre_cliente, formatMXN(p.monto_total_acordado), formatMXN(ab), formatMXN(s), est]
    }),
    foot: [['TOTALES', formatMXN(totalAcordado), formatMXN(totalAbonado), formatMXN(totalSaldo), '']],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: C.forest, textColor: C.sun, fontStyle: 'bold' },
    footStyles: { fillColor: C.olive, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 248, 244] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
    theme: 'grid',
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const val = data.cell.text[0]
        if (val === 'Liquidado') data.cell.styles.textColor = C.olive
        else if (val === 'Parcial') data.cell.styles.textColor = [122, 90, 0]
        else data.cell.styles.textColor = C.red
      }
    }
  })

  y = doc.lastAutoTable.finalY + 10

  // Gastos del evento
  if (gastos.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...C.forest)
    doc.text('GASTOS DEL EVENTO', 14, y)
    y += 4

    const totalGastos = gastos.reduce((s, g) => s + Number(g.importe), 0)
    doc.autoTable({
      startY: y,
      head: [['Fecha', 'Concepto', 'Categoría', 'Proveedor', 'Importe']],
      body: gastos.map(g => [formatDate(g.fecha), g.concepto, g.categoria, g.proveedor_nombre || '—', formatMXN(g.importe)]),
      foot: [['', '', '', 'TOTAL GASTOS', formatMXN(totalGastos)]],
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: C.red, textColor: C.white, fontStyle: 'bold' },
      footStyles: { fillColor: [80, 30, 30], textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 252, 252] },
      columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
      theme: 'grid'
    })

    y = doc.lastAutoTable.finalY + 10
    const utilidad = totalAbonado - totalGastos

    // Cuadro de utilidad
    doc.setFillColor(...(utilidad >= 0 ? C.cream : [252, 236, 234]))
    doc.roundedRect(W / 2 - 10, y, W / 2 - 4, 26, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.gray)
    doc.text('Ingresos:', W / 2, y + 8)
    doc.text('Gastos:', W / 2, y + 16)
    doc.text('UTILIDAD:', W / 2, y + 24)
    doc.setTextColor(...C.forest)
    doc.text(formatMXN(totalAbonado), W - 16, y + 8, { align: 'right' })
    doc.setTextColor(...C.red)
    doc.text(formatMXN(totalGastos), W - 16, y + 16, { align: 'right' })
    doc.setFontSize(11)
    doc.setTextColor(...(utilidad >= 0 ? C.olive : C.red))
    doc.text(formatMXN(utilidad), W - 16, y + 24, { align: 'right' })
  }

  drawFooter(doc)
  doc.save(`Reporte_${evento.nombre.replace(/[^a-zA-Z0-9]/g,'_').slice(0,30)}_${folio}.pdf`)
}

// ── Estado de resultados global ─────────────────────────────────
export async function generarEstadoResultados(periodo, ingresos, gastos, utilidad, detalle) {
  const jsPDF = await getJsPDF()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const folio = generateFolio('ER')
  const W = doc.internal.pageSize.getWidth()

  drawHeader(doc, folio)
  let y = 48

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...C.forest)
  doc.text('ESTADO DE RESULTADOS', W / 2, y, { align: 'center' })
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...C.gray)
  doc.text(`Período: ${periodo}`, W / 2, y, { align: 'center' })
  y += 12

  // Ingresos
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.olive)
  doc.text('+ INGRESOS', 14, y)
  y += 5
  doc.autoTable({
    startY: y,
    body: detalle.ingresos.map(r => [r.label, formatMXN(r.valor)]),
    foot: [['TOTAL INGRESOS', formatMXN(ingresos)]],
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: C.olive },
    footStyles: { fillColor: C.olive, textColor: C.white, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
    theme: 'striped'
  })
  y = doc.lastAutoTable.finalY + 8

  // Gastos
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.red)
  doc.text('- GASTOS', 14, y)
  y += 5
  doc.autoTable({
    startY: y,
    body: detalle.gastos.map(r => [r.label, formatMXN(r.valor)]),
    foot: [['TOTAL GASTOS', formatMXN(gastos)]],
    styles: { font: 'helvetica', fontSize: 9 },
    footStyles: { fillColor: C.red, textColor: C.white, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
    theme: 'striped'
  })
  y = doc.lastAutoTable.finalY + 10

  // Utilidad
  doc.setFillColor(...(utilidad >= 0 ? [234, 240, 216] : [252, 236, 234]))
  doc.roundedRect(14, y, W - 28, 22, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...(utilidad >= 0 ? C.olive : C.red))
  doc.text(utilidad >= 0 ? '= UTILIDAD NETA' : '= PÉRDIDA NETA', 20, y + 14)
  doc.setFontSize(18)
  doc.text(formatMXN(utilidad), W - 20, y + 14, { align: 'right' })

  drawFooter(doc)
  doc.save(`EstadoResultados_${folio}.pdf`)
}
