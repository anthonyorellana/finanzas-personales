import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

export default function Analisis() {
  const [meses, setMeses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('meses').select('*').order('mes')
    setMeses(data || [])
    setLoading(false)
  }

  const datos = meses.map(m => ({
    mes: m.mes.replace(' 2025', '').replace(' 2026', ''),
    Ingresos: Number(m.ingresos_estimados),
    Gastos: Number(m.presupuesto_gastos),
    Ahorro: Number(m.ingresos_estimados) - Number(m.presupuesto_gastos),
  }))

  const totalIngresos = meses.reduce((s, m) => s + Number(m.ingresos_estimados), 0)
  const totalGastos = meses.reduce((s, m) => s + Number(m.presupuesto_gastos), 0)
  const totalAhorro = totalIngresos - totalGastos
  const tasaMedia = totalIngresos > 0 ? ((totalAhorro / totalIngresos) * 100).toFixed(1) : 0

  const tooltipStyle = {
    backgroundColor: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text)',
  }

  if (loading) return <div style={{ color: 'var(--text2)', padding: '40px' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '24px' }}>📉 Análisis Histórico</h1>

      {/* Resumen total */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {[
          { label: '💰 Total ingresos', value: fmt(totalIngresos), color: 'var(--green)' },
          { label: '💸 Total gastos', value: fmt(totalGastos), color: 'var(--red)' },
          { label: '💾 Total ahorrado', value: fmt(totalAhorro), color: 'var(--blue)' },
          { label: '📊 Tasa ahorro media', value: `${tasaMedia}%`, color: 'var(--purple)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: 1, minWidth: '150px', background: 'var(--bg2)',
            border: '1px solid var(--border)', borderRadius: '16px', padding: '20px',
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>{label}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Gráfico barras ingresos vs gastos */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>📊 Ingresos vs Gastos</div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={datos} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="mes" tick={{ fill: '#8b8fa8', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: '13px' }} />
            <Bar dataKey="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico línea ahorro */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>💾 Ahorro mensual</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={datos} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="mes" tick={{ fill: '#8b8fa8', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
            <Line type="monotone" dataKey="Ahorro" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla histórica */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>📋 Tabla histórica</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Mes', 'Ingresos', 'Gastos', 'Ahorro', 'Tasa'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text2)', fontWeight: '600', whiteSpace: 'nowrap' }}
                    className={h === 'Mes' ? 'text-left' : ''}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meses.map(m => {
                const ahorro = Number(m.ingresos_estimados) - Number(m.presupuesto_gastos)
                const tasa = Number(m.ingresos_estimados) > 0
                  ? ((ahorro / Number(m.ingresos_estimados)) * 100).toFixed(1)
                  : 0
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{m.mes}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--green)', fontWeight: '600' }}>{fmt(m.ingresos_estimados)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--red)', fontWeight: '600' }}>{fmt(m.presupuesto_gastos)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: ahorro >= 0 ? 'var(--blue)' : 'var(--red)', fontWeight: '600' }}>{fmt(ahorro)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: tasa >= 0 ? 'var(--green)' : 'var(--red)' }}>{tasa}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}