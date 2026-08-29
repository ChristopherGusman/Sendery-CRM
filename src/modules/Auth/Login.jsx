import React, { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { LogIn, Mountain } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Correo o contraseña incorrectos.')
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#2C3A1A', padding: 20
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#F5F0E8', borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.35)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, background: '#E8C547', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Mountain size={26} color="#2C3A1A" strokeWidth={2.5} />
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 700, color: '#2C3A1A', letterSpacing: 1.5 }}>
            SENDERY CRM
          </div>
          <div style={{ fontFamily: 'DM Sans', fontSize: 13, color: '#6B7B4F' }}>
            Inicia sesión para continuar
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, color: '#2C3A1A', display: 'block', marginBottom: 5 }}>
              Correo
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tucorreo@sendery.mx"
              style={{
                width: '100%', padding: '10px 12px', border: '1.5px solid rgba(196,169,125,0.4)',
                borderRadius: 8, fontFamily: 'DM Sans', fontSize: 14, color: '#2C3A1A',
                background: '#FDFCFA', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, color: '#2C3A1A', display: 'block', marginBottom: 5 }}>
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '10px 12px', border: '1.5px solid rgba(196,169,125,0.4)',
                borderRadius: 8, fontFamily: 'DM Sans', fontSize: 14, color: '#2C3A1A',
                background: '#FDFCFA', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#FCECEA', color: '#8B1A1A', borderRadius: 8,
              padding: '9px 12px', fontFamily: 'DM Sans', fontSize: 13
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#E8C547', color: '#2C3A1A', border: 'none', borderRadius: 8,
              padding: '11px 18px', fontFamily: 'DM Sans', fontWeight: 700, fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              marginTop: 6
            }}
          >
            <LogIn size={16} />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>

        <div style={{ marginTop: 20, fontFamily: 'DM Sans', fontSize: 11, color: '#6B7B4F', textAlign: 'center' }}>
          ¿No tienes cuenta? Pídele a un administrador que te dé de alta desde Supabase.
        </div>
      </form>
    </div>
  )
}
