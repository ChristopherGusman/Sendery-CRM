// ── Formateo de moneda MXN ──────────────────────────────────────
export function formatMXN(amount) {
  if (amount === null || amount === undefined) return '$0.00'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(Number(amount) || 0)
}

// ── Formateo de fechas ──────────────────────────────────────────
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('T')[0].split('-')
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`
}

export function formatDateLong(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('T')[0].split('-')
  const months = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${parseInt(d)} de ${months[parseInt(m)-1]} de ${y}`
}

// ── Estado de pago ──────────────────────────────────────────────
export function getPaymentStatus(saldo, total) {
  if (saldo <= 0) return { label: 'Liquidado', bg: '#EAF0D8', color: '#2C3A1A' }
  if (saldo < total) return { label: 'Abono parcial', bg: '#FFF3CC', color: '#7A5A00' }
  return { label: 'Sin pago', bg: '#FCECEA', color: '#8B1A1A' }
}

// ── Estado de evento ────────────────────────────────────────────
export function getEventoStatus(estado) {
  const map = {
    activo: { label: 'Activo', bg: '#EAF0D8', color: '#2C3A1A' },
    cerrado: { label: 'Cerrado', bg: '#E8E8E8', color: '#555' },
    cancelado: { label: 'Cancelado', bg: '#FCECEA', color: '#8B1A1A' }
  }
  return map[estado] || map.activo
}

// ── Folio único ─────────────────────────────────────────────────
export function generateFolio(prefix = 'SND') {
  const now = new Date()
  const ts = now.getFullYear().toString().slice(-2) +
    String(now.getMonth()+1).padStart(2,'0') +
    String(now.getDate()).padStart(2,'0') +
    String(now.getHours()).padStart(2,'0') +
    String(now.getMinutes()).padStart(2,'0')
  return `${prefix}-${ts}`
}

// ── Hoy en formato YYYY-MM-DD ───────────────────────────────────
export function today() {
  return new Date().toISOString().split('T')[0]
}
