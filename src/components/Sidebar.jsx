import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, Users, Receipt,
  Truck, Landmark, FileBarChart2, ChevronLeft, ChevronRight,
  Mountain, FileUp
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/eventos', icon: CalendarDays, label: 'Eventos' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/gastos', icon: Receipt, label: 'Gastos' },
  { to: '/proveedores', icon: Truck, label: 'Proveedores' },
  { to: '/cuentas', icon: Landmark, label: 'Cuentas Bancarias' },
  { to: '/reportes', icon: FileBarChart2, label: 'Reportes' },
  { to: '/importador', icon: FileUp, label: 'Importar Excel', divider: true },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  return (
    <aside style={{
      width: collapsed ? 68 : 230,
      minHeight: '100vh',
      background: '#2C3A1A',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s ease',
      position: 'relative',
      flexShrink: 0,
      zIndex: 10
    }}>
      {/* Logo / Marca */}
      <div style={{
        padding: collapsed ? '24px 0' : '24px 20px',
        borderBottom: '1px solid rgba(196,169,125,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        justifyContent: collapsed ? 'center' : 'flex-start'
      }}>
        <div style={{
          width: 36, height: 36, background: '#E8C547', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <Mountain size={20} color="#2C3A1A" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div>
            <div style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: 18,
              fontWeight: 700,
              color: '#E8C547',
              letterSpacing: 1.5,
              lineHeight: 1.1
            }}>SENDERY</div>
            <div style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 10,
              color: '#C4A97D',
              letterSpacing: 0.5,
              textTransform: 'uppercase'
            }}>Outdoor Lifestyle</div>
          </div>
        )}
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label, divider }) => {
          const isActive = to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to)

          return (
            <React.Fragment key={to}>
            {divider && (
              <div style={{
                margin: '8px 16px',
                borderTop: '1px solid rgba(196,169,125,0.2)'
              }}/>
            )}
            <NavLink
              to={to}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: collapsed ? '12px 0' : '11px 20px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                textDecoration: 'none',
                background: isActive ? 'rgba(232,197,71,0.12)' : 'transparent',
                borderLeft: isActive ? '3px solid #E8C547' : '3px solid transparent',
                color: isActive ? '#E8C547' : '#C4A97D',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(196,169,125,0.08)'
                  e.currentTarget.style.color = '#F5F0E8'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#C4A97D'
                }
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
            </React.Fragment>
          )
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(196,169,125,0.15)',
          color: '#6B7B4F',
          fontSize: 11,
          fontFamily: 'DM Sans',
          lineHeight: 1.5
        }}>
          <div style={{ color: '#C4A97D', fontWeight: 500 }}>Sendery CRM v1.0</div>
          <div>Ensenada, Baja California</div>
          <div style={{ marginTop: 4 }}>
            <span style={{
              background: '#EAF0D8', color: '#2C3A1A',
              padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600
            }}>MXN</span>
          </div>
        </div>
      )}

      {/* Toggle colapso */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          position: 'absolute',
          right: -14,
          top: 72,
          width: 28, height: 28,
          background: '#E8C547',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          zIndex: 20
        }}
      >
        {collapsed
          ? <ChevronRight size={14} color="#2C3A1A" />
          : <ChevronLeft size={14} color="#2C3A1A" />}
      </button>
    </aside>
  )
}
