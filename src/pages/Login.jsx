import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '360px',
      }}>
        <div style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
          💰 Finanzas
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '28px' }}>
          Inicia sesión para continuar
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>Email</div>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus
              style={{
                width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '10px 14px', color: 'var(--text)',
                fontSize: '15px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>Contraseña</div>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '10px 14px', color: 'var(--text)',
                fontSize: '15px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          {error && (
            <div style={{
              fontSize: '13px', color: 'var(--red)', background: 'rgba(239,68,68,0.1)',
              border: '1px solid var(--red)', borderRadius: '8px',
              padding: '10px 14px', marginBottom: '16px',
            }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            width: '100%', background: 'var(--blue)', color: 'white', border: 'none',
            borderRadius: '10px', padding: '12px', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '15px', fontWeight: '600', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
