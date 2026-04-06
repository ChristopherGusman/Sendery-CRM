import React, { createContext, useContext, useState, useEffect } from 'react'
import { initDatabase } from './database.js'

const DBContext = createContext(null)

export function DBProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    initDatabase()
      .then(() => setReady(true))
      .catch(err => {
        console.error('Error iniciando DB:', err)
        setError(err.message)
      })
  }, [])

  if (error) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#F5F0E8', flexDirection: 'column', gap: 16
    }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <div style={{ fontFamily: 'DM Sans', color: '#2C3A1A', fontSize: 18 }}>
        Error al inicializar la base de datos
      </div>
      <div style={{ fontFamily: 'monospace', color: '#8B1A1A', fontSize: 13 }}>{error}</div>
    </div>
  )

  if (!ready) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#2C3A1A', flexDirection: 'column', gap: 20
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 48, height: 48, border: '4px solid #E8C547',
          borderTop: '4px solid transparent', borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
      <div style={{ color: '#E8C547', fontFamily: 'Oswald, sans-serif', fontSize: 24, letterSpacing: 2 }}>
        SENDERY CRM
      </div>
      <div style={{ color: '#C4A97D', fontFamily: 'DM Sans', fontSize: 14 }}>
        Iniciando sistema...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return <DBContext.Provider value={{ ready }}>{children}</DBContext.Provider>
}

export function useDB() {
  return useContext(DBContext)
}
