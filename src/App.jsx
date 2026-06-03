import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Transacciones from './pages/Transacciones'
import Presupuesto from './pages/Presupuesto'
import Cartera from './pages/Cartera'
import Analisis from './pages/Analisis'
import './index.css'

const NAV = [
  { id: 'dashboard', label: 'Inicio', icon: '📊' },
  { id: 'transacciones', label: 'Movimientos', icon: '💳' },
  { id: 'presupuesto', label: 'Presupuesto', icon: '📅' },
  { id: 'cartera', label: 'Cartera', icon: '📈' },
  { id: 'analisis', label: 'Análisis', icon: '📉' },
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', color: 'var(--text2)', background: 'var(--bg)',
    }}>
      Cargando...
    </div>
  )

  if (!session) return <Login />

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />
      case 'transacciones': return <Transacciones />
      case 'presupuesto': return <Presupuesto />
      case 'cartera': return <Cartera />
      case 'analisis': return <Analisis />
      default: return <Dashboard />
    }
  }

  return (
    <div className="app-layout">
      {/* Sidebar — solo escritorio */}
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px', padding: '0 8px' }}>
          💰 Finanzas
        </div>
        <div style={{ flex: 1 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: '10px', border: 'none',
              background: page === n.id ? 'var(--blue)' : 'transparent',
              color: page === n.id ? 'white' : 'var(--text2)',
              cursor: 'pointer', fontSize: '14px', fontWeight: '500', textAlign: 'left',
              width: '100%',
            }}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', borderRadius: '10px', border: 'none',
          background: 'transparent', color: 'var(--text2)',
          cursor: 'pointer', fontSize: '14px', fontWeight: '500', textAlign: 'left',
          width: '100%',
        }}>
          <span>🚪</span>Cerrar sesión
        </button>
      </aside>

      {/* Contenido principal */}
      <main className="main-content">
        {renderPage()}
      </main>

      {/* Barra inferior — solo móvil */}
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            background: page === n.id ? 'var(--bg3)' : 'none',
            border: 'none', borderRadius: '10px',
            color: page === n.id ? 'var(--blue)' : 'var(--text2)',
            cursor: 'pointer', fontSize: '10px', padding: '6px 8px',
            flex: 1,
          }}>
            <span style={{ fontSize: '20px' }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
        <button onClick={() => supabase.auth.signOut()} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
          background: 'none', border: 'none', borderRadius: '10px',
          color: 'var(--text2)', cursor: 'pointer', fontSize: '10px',
          padding: '6px 8px', flex: 1,
        }}>
          <span style={{ fontSize: '20px' }}>🚪</span>
          Salir
        </button>
      </nav>
    </div>
  )
}
