import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const Card = ({ title, value, sub, color = 'var(--blue)' }) => (
  <div style={{
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: '16px', padding: '20px', flex: '1', minWidth: '160px',
  }}>
    <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>{title}</div>
    <div style={{ fontSize: '26px', fontWeight: '700', color }}>{value}</div>
    {sub && <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '4px' }}>{sub}</div>}
  </div>
)

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

export default function Dashboard() {
  const [cuentas, setCuentas] = useState([])
  const [meses, setMeses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: c }, { data: m }] = await Promise.all([
        supabase.from('cuentas').select('*'),
        supabase.from('meses').select('*'),
      ])
      setCuentas(c || [])
      setMeses(m || [])
      setLoading(false)
    }
    load()
  }, [])

  const patrimonio = cuentas.reduce((s, c) => s + Number(c.saldo), 0)
  const santander = cuentas.find(c => c.nombre === 'Santander')?.saldo || 0
  const trLiquidez = cuentas.find(c => c.nombre === 'TR — Liquidez')?.saldo || 0
  const etfs = cuentas.filter(c => c.tipo === 'etf').reduce((s, c) => s + Number(c.saldo), 0)

  const mesesOrdenados = [...meses].sort((a, b) => a.mes.localeCompare(b.mes))
  const mesActual = mesesOrdenados[mesesOrdenados.length - 1]
  const tasaAhorro = mesActual
    ? ((mesActual.ingresos_estimados - mesActual.presupuesto_gastos) / mesActual.ingresos_estimados * 100).toFixed(1)
    : 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text2)' }}>
      Cargando...
    </div>
  )

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '24px' }}>
        💰 Panel de Finanzas
      </h1>

      {/* Tarjetas principales */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <Card title="💶 Patrimonio Total" value={fmt(patrimonio)} color="var(--green)" />
        <Card title="🏦 Santander" value={fmt(santander)} sub="Cuenta corriente" />
        <Card title="📱 TR Liquidez" value={fmt(trLiquidez)} sub="2% TAE • ~7,9€/mes" color="var(--purple)" />
        <Card title="📈 ETFs" value={fmt(etfs)} sub="MSCI World + Semi" color="var(--yellow)" />
      </div>

      {/* Mes actual */}
      {mesActual && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '20px', marginBottom: '24px',
        }}>
          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>
            📅 {mesActual.mes} — Resumen
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Ingresos estimados</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--green)' }}>{fmt(mesActual.ingresos_estimados)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Presupuesto gastos</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--red)' }}>{fmt(mesActual.presupuesto_gastos)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Para invertir</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--blue)' }}>
                {fmt(mesActual.ingresos_estimados - mesActual.presupuesto_gastos)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Tasa de ahorro</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: tasaAhorro > 0 ? 'var(--green)' : 'var(--red)' }}>
                {tasaAhorro}%
              </div>
            </div>
          </div>
          {mesActual.notas && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text2)', background: 'var(--bg3)', padding: '10px', borderRadius: '8px' }}>
              {mesActual.notas}
            </div>
          )}
        </div>
      )}

      {/* Objetivo julio */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>🚀 Objetivo — 2 Julio 2026</div>
        {[
          { label: '🏦 Santander', actual: santander, objetivo: 1100 },
          { label: '📱 TR Liquidez', actual: trLiquidez, objetivo: 6000 },
          { label: '📈 ETFs', actual: etfs, objetivo: 730 },
        ].map(({ label, actual, objetivo }) => {
          const pct = Math.min((actual / objetivo) * 100, 100).toFixed(0)
          return (
            <div key={label} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span>{label}</span>
                <span style={{ color: 'var(--text2)' }}>{fmt(actual)} / {fmt(objetivo)}</span>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: '99px', height: '8px' }}>
                <div style={{
                  width: `${pct}%`, height: '8px', borderRadius: '99px',
                  background: pct >= 100 ? 'var(--green)' : 'var(--blue)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}