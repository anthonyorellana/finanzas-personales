import { useState } from 'react'
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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar — visible en tablet y escritorio */}
      <aside style={{
        width: '220px', background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px',
        position: 'fixed', top: 0, left: 0, height: '100vh',
      }} className="sidebar">
        <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px', padding: '0 8px' }}>
          💰 Finanzas
        </div>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', borderRadius: '10px', border: 'none',
            background: page === n.id ? 'var(--blue)' : 'transparent',
            color: page === n.id ? 'white' : 'var(--text2)',
            cursor: 'pointer', fontSize: '14px', fontWeight: '500', textAlign: 'left',
          }}>
            <span>{n.icon}</span>{n.label}
          </button>
        ))}
      </aside>

      {/* Contenido principal */}
      <main style={{ marginLeft: '220px', flex: 1, padding: '24px', paddingBottom: '80px' }} className="main-content">
        {renderPage()}
      </main>

      {/* Barra inferior — solo móvil */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg2)', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-around', padding: '8px 0',
      }} className="bottom-nav">
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            background: 'none', border: 'none', color: page === n.id ? 'var(--blue)' : 'var(--text2)',
            cursor: 'pointer', fontSize: '10px', padding: '4px 8px',
          }}>
            <span style={{ fontSize: '20px' }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  )
}