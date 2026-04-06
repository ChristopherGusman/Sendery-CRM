import React from 'react'
import Sidebar from './Sidebar.jsx'

export default function Layout({ children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F0E8', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        overflow: 'auto',
        background: '#F5F0E8',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {children}
      </main>
    </div>
  )
}

// ── Componentes reutilizables UI ────────────────────────────────

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      padding: '28px 32px 20px',
      borderBottom: '1px solid rgba(44,58,26,0.1)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      background: '#F5F0E8'
    }}>
      <div>
        <h1 style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 26,
          fontWeight: 700,
          color: '#2C3A1A',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          margin: 0
        }}>{title}</h1>
        {subtitle && (
          <p style={{
            fontFamily: 'DM Sans',
            fontSize: 14,
            color: '#6B7B4F',
            margin: '4px 0 0'
          }}>{subtitle}</p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  )
}

export function PageContent({ children, style = {} }) {
  return (
    <div style={{
      padding: '24px 32px',
      flex: 1,
      ...style
    }}>
      {children}
    </div>
  )
}

export function Card({ children, style = {}, title, headerActions }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid rgba(196,169,125,0.25)',
      boxShadow: '0 1px 4px rgba(44,58,26,0.06)',
      overflow: 'hidden',
      ...style
    }}>
      {title && (
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(196,169,125,0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{
            fontFamily: 'DM Sans',
            fontSize: 14,
            fontWeight: 600,
            color: '#2C3A1A'
          }}>{title}</span>
          {headerActions}
        </div>
      )}
      {children}
    </div>
  )
}

export function Btn({ children, variant = 'primary', onClick, type = 'button', disabled, size = 'md', icon }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: 'DM Sans', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none', borderRadius: 8, transition: 'all 0.15s ease',
    opacity: disabled ? 0.6 : 1,
    whiteSpace: 'nowrap'
  }
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12 },
    md: { padding: '9px 18px', fontSize: 14 },
    lg: { padding: '12px 24px', fontSize: 15 }
  }
  const variants = {
    primary: { background: '#E8C547', color: '#2C3A1A' },
    secondary: { background: '#4A5E28', color: '#F5F0E8' },
    ghost: { background: 'transparent', color: '#4A5E28', border: '1px solid #4A5E28' },
    danger: { background: '#FCECEA', color: '#8B1A1A', border: '1px solid #f5c6c6' },
    outline: { background: 'transparent', color: '#2C3A1A', border: '1px solid rgba(44,58,26,0.3)' }
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant] }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.opacity = '0.85'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.opacity = '1'
      }}
    >
      {icon && icon}
      {children}
    </button>
  )
}

export function Badge({ label, bg, color, size = 'sm' }) {
  return (
    <span style={{
      background: bg || '#EAF0D8',
      color: color || '#2C3A1A',
      padding: size === 'sm' ? '3px 8px' : '5px 12px',
      borderRadius: 20,
      fontSize: size === 'sm' ? 11 : 13,
      fontWeight: 600,
      fontFamily: 'DM Sans',
      whiteSpace: 'nowrap'
    }}>{label}</span>
  )
}

export function Modal({ open, onClose, title, children, width = 560 }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(44,58,26,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: 14,
        width: '100%', maxWidth: width,
        maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        animation: 'modalIn 0.2s ease'
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(196,169,125,0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1
        }}>
          <span style={{
            fontFamily: 'Oswald, sans-serif', fontSize: 18,
            fontWeight: 600, color: '#2C3A1A', textTransform: 'uppercase', letterSpacing: 0.5
          }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#6B7B4F', fontSize: 20, lineHeight: 1, padding: 4
          }}>✕</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
    </div>
  )
}

export function FormField({ label, required, children, error, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{
        fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600,
        color: '#2C3A1A'
      }}>
        {label}{required && <span style={{ color: '#8B1A1A' }}> *</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: '#6B7B4F' }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: '#8B1A1A' }}>{error}</span>}
    </div>
  )
}

export const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1.5px solid rgba(196,169,125,0.4)',
  borderRadius: 8,
  fontFamily: 'DM Sans',
  fontSize: 14,
  color: '#2C3A1A',
  background: '#FDFCFA',
  outline: 'none',
  transition: 'border-color 0.15s ease',
  boxSizing: 'border-box'
}

export function Input({ style = {}, ...props }) {
  return (
    <input
      {...props}
      style={{ ...inputStyle, ...style }}
      onFocus={e => e.target.style.borderColor = '#4A5E28'}
      onBlur={e => e.target.style.borderColor = 'rgba(196,169,125,0.4)'}
    />
  )
}

export function Select({ children, style = {}, ...props }) {
  return (
    <select
      {...props}
      style={{ ...inputStyle, ...style, cursor: 'pointer' }}
      onFocus={e => e.target.style.borderColor = '#4A5E28'}
      onBlur={e => e.target.style.borderColor = 'rgba(196,169,125,0.4)'}
    >
      {children}
    </select>
  )
}

export function Textarea({ style = {}, ...props }) {
  return (
    <textarea
      {...props}
      style={{ ...inputStyle, minHeight: 80, resize: 'vertical', ...style }}
      onFocus={e => e.target.style.borderColor = '#4A5E28'}
      onBlur={e => e.target.style.borderColor = 'rgba(196,169,125,0.4)'}
    />
  )
}

export function Table({ headers, children, empty = 'Sin registros' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        fontFamily: 'DM Sans', fontSize: 13
      }}>
        <thead>
          <tr style={{ background: '#2C3A1A' }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: '10px 14px', textAlign: 'left',
                color: '#E8C547', fontWeight: 600, fontSize: 12,
                textTransform: 'uppercase', letterSpacing: 0.5,
                whiteSpace: 'nowrap'
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {!children || (Array.isArray(children) && children.length === 0) && (
        <div style={{ textAlign: 'center', padding: 32, color: '#6B7B4F', fontFamily: 'DM Sans' }}>
          {empty}
        </div>
      )}
    </div>
  )
}

export function TR({ children, onClick, highlight }) {
  const [hover, setHover] = React.useState(false)
  return (
    <tr
      style={{
        background: highlight ? 'rgba(232,197,71,0.06)' : hover ? 'rgba(74,94,40,0.04)' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        borderBottom: '1px solid rgba(196,169,125,0.12)',
        transition: 'background 0.1s'
      }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </tr>
  )
}

export function TD({ children, style = {} }) {
  return (
    <td style={{ padding: '10px 14px', color: '#2C3A1A', verticalAlign: 'middle', ...style }}>
      {children}
    </td>
  )
}

export function SearchBar({ value, onChange, placeholder = 'Buscar...', style = {} }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <span style={{
        position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
        color: '#6B7B4F', fontSize: 14, pointerEvents: 'none'
      }}>🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...inputStyle,
          paddingLeft: 32,
          width: '100%'
        }}
        onFocus={e => e.target.style.borderColor = '#4A5E28'}
        onBlur={e => e.target.style.borderColor = 'rgba(196,169,125,0.4)'}
      />
    </div>
  )
}

export function KPICard({ label, value, sub, icon, color = '#2C3A1A', accent = '#E8C547' }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '20px',
      border: '1px solid rgba(196,169,125,0.2)',
      boxShadow: '0 1px 4px rgba(44,58,26,0.06)',
      display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600,
          color: '#6B7B4F', textTransform: 'uppercase', letterSpacing: 0.5
        }}>{label}</div>
        {icon && (
          <div style={{
            width: 36, height: 36, background: accent + '22',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>{icon}</div>
        )}
      </div>
      <div style={{
        fontFamily: 'Oswald, sans-serif', fontSize: 28,
        fontWeight: 700, color
      }}>{value}</div>
      {sub && (
        <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: '#6B7B4F' }}>{sub}</div>
      )}
    </div>
  )
}
