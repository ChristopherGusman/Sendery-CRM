import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import Login from '../modules/Auth/Login.jsx'

const DBContext = createContext(null)

export function DBProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = aún no se sabe, null = sin sesión
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase.from('eventos').select('id', { count: 'exact', head: true })
      .then(({ error }) => {
        if (error) setError(error.message)
        else setReady(true)
      })
  }, [session])

  if (session === undefined) return null // esperando a saber si hay sesión

  if (session === null) return <Login />

  if (error) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#F5F0E8', flexDirection: 'column', gap: 16
    }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <div style={{ fontFamily: 'DM Sans', color: '#2C3A1A', fontSize: 18 }}>
        Error al conectar con la base de datos
      </div>
      <div style={{ fontFamily: 'monospace', color: '#8B1A1A', fontSize: 13, maxWidth: 500, textAlign: 'center' }}>{error}</div>
      <div style={{ fontFamily: 'DM Sans', color: '#6B7B4F', fontSize: 13 }}>
        Verifica que VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY estén configuradas en el archivo .env
      </div>
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
        Conectando con Supabase...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <DBContext.Provider value={{ ready, session, signOut: () => supabase.auth.signOut() }}>
      {children}
    </DBContext.Provider>
  )
}

export function useDB() {
  return useContext(DBContext)
}
