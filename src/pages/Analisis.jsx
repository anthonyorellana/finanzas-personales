import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

function TooltipPatrimonio({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', fontSize: '12px', minWidth: '160px' }}>
      <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '8px', color: 'var(--text)' }}>{fmt(d.Total)}</div>
      {Object.entries(d.detalle || {}).map(([nombre, saldo]) => (
        <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: 'var(--text2)', marginBottom: '4px' }}>
          <span>{nombre}</span><span style={{ color: 'var(--text)' }}>{fmt(saldo)}</span>
        </div>
      ))}
    </div>
  )
}

const COLORES = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
  '#a855f7', '#eab308', '#64748b', '#10b981', '#6366f1',
]

export default function Analisis() {
  const [meses, setMeses] = useState([])
  const [transacciones, setTransacciones] = useState([])
  const [categorias, setCategorias] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: m }, { data: t }, { data: c }, { data: s }] = await Promise.all([
      supabase.from('meses').select('*').order('mes'),
      supabase.from('transacciones').select('*').order('fecha', { ascending: false }),
      supabase.from('categorias').select('*'),
      supabase.from('snapshots_patrimonio').select('*').order('fecha'),
    ])
    setMeses(m || [])
    setTransacciones(t || [])
    setCategorias(c || [])
    setSnapshots(s || [])
    setLoading(false)
  }

  const datosSnaps = snapshots.map(s => ({
    mes: s.mes.replace(' 2025', '').replace(' 2026', ''),
    Total: s.total,
    detalle: s.detalle,
  }))

  const txPorMes = {}
  const txNormPorMes = {}
  transacciones.forEach(t => {
    if (!t.mes || t.tipo !== '⬇ Gasto') return
    txPorMes[t.mes] = (txPorMes[t.mes] || 0) + Math.abs(Number(t.importe))
    if (!t.es_extraordinario) {
      txNormPorMes[t.mes] = (txNormPorMes[t.mes] || 0) + Math.abs(Number(t.importe))
    }
  })

  const totalIngresos = meses.reduce((s, m) => s + Number(m.ingresos_estimados), 0)
  const totalGastosReal = meses.reduce((s, m) => s + (txPorMes[m.mes] || 0), 0)
  const totalAhorro = totalIngresos - totalGastosReal
  const tasaMedia = totalIngresos > 0 ? ((totalAhorro / totalIngresos) * 100).toFixed(1) : 0

  const datosMeses = meses.map(m => ({
    mes: m.mes.replace(' 2025', '').replace(' 2026', ''),
    'Presupuesto': Number(m.presupuesto_gastos),
    'Gastos reales': txPorMes[m.mes] || 0,
    'Gasto normal': txNormPorMes[m.mes] || txPorMes[m.mes] || 0,
    'Ahorro real': Number(m.ingresos_estimados) - (txPorMes[m.mes] || 0),
  }))

  const hayExtraordinarios = transacciones.some(t => t.es_extraordinario)

  // Gastos por categoría
  const txFiltradas = transacciones.filter(t => {
    if (filtroMes && t.mes !== filtroMes) return false
    return t.tipo === '⬇ Gasto' && t.categoria
  })

  const porCategoria = categorias.map(cat => {
    const total = txFiltradas
      .filter(t => t.categoria === cat.nombre)
      .reduce((s, t) => s + Math.abs(t.importe), 0)
    return { nombre: cat.nombre, emoji: cat.emoji, total }
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const totalCategorizado = porCategoria.reduce((s, c) => s + c.total, 0)

  const mesesDisponibles = [...new Set(transacciones.map(t => t.mes).filter(Boolean))].sort().reverse()

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
          { label: '💸 Total gastos reales', value: fmt(totalGastosReal), color: 'var(--red)' },
          { label: '💾 Total ahorrado', value: fmt(totalAhorro), color: 'var(--blue)' },
          { label: '📊 Tasa ahorro media', value: `${tasaMedia}%`, color: 'var(--purple)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: 1, minWidth: '140px', background: 'var(--bg2)',
            border: '1px solid var(--border)', borderRadius: '16px', padding: '16px',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Evolución del patrimonio */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: '600' }}>📈 Evolución del patrimonio</div>
          {datosSnaps.length > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
              {fmt(snapshots[snapshots.length - 1]?.total || 0)}
              {datosSnaps.length > 1 && (() => {
                const diff = snapshots[snapshots.length - 1].total - snapshots[0].total
                return (
                  <span style={{ marginLeft: '8px', color: diff >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {diff >= 0 ? '+' : ''}{fmt(diff)} total
                  </span>
                )
              })()}
            </div>
          )}
        </div>
        {datosSnaps.length < 2 ? (
          <div style={{ textAlign: 'center', color: 'var(--text2)', padding: '40px 20px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📸</div>
            <div style={{ fontSize: '14px', marginBottom: '6px' }}>Aún no hay suficientes datos</div>
            <div style={{ fontSize: '12px' }}>
              Guarda un snapshot cada mes desde el Dashboard para ver la evolución aquí.
              {datosSnaps.length === 1 && ' Ya tienes 1 — guarda otro el mes que viene.'}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={datosSnaps} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPatrimonio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k€`} />
              <Tooltip content={<TooltipPatrimonio />} />
              <Area type="monotone" dataKey="Total" stroke="#3b82f6" strokeWidth={2} fill="url(#gradPatrimonio)" dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Gráfico barras ingresos vs gastos */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>📊 Presupuesto vs Gastos reales</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={datosMeses} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="mes" tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: '13px' }} />
            <Bar dataKey="Presupuesto" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Gastos reales" fill="#ef4444" radius={[4, 4, 0, 0]} />
            {hayExtraordinarios && <Bar dataKey="Gasto normal" fill="#f59e0b" radius={[4, 4, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico línea ahorro */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>💾 Ahorro real mensual</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={datosMeses} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="mes" tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
            <Line type="monotone" dataKey="Ahorro real" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Gastos por categoría */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '15px', fontWeight: '600' }}>🏷️ Gastos por categoría</div>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '6px 12px', color: 'var(--text)', fontSize: '13px',
            }}>
            <option value="">Todos los meses</option>
            {mesesDisponibles.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        {porCategoria.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text2)', padding: '40px' }}>
            No hay transacciones categorizadas aún.<br />
            <span style={{ fontSize: '12px' }}>Ve a Movimientos y pulsa 🏷️ en cada transacción.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {/* Donut */}
            <div style={{ flex: '0 0 auto' }}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={porCategoria}
                    dataKey="total"
                    nameKey="nombre"
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={2}
                  >
                    {porCategoria.map((_, i) => (
                      <Cell key={i} fill={COLORES[i % COLORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Lista */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              {porCategoria.map((cat, i) => {
                const pct = ((cat.total / totalCategorizado) * 100).toFixed(1)
                return (
                  <div key={cat.nombre} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span>{cat.emoji} {cat.nombre}</span>
                      <span style={{ color: 'var(--text2)' }}>{fmt(cat.total)} · {pct}%</span>
                    </div>
                    <div style={{ background: 'var(--bg3)', borderRadius: '99px', height: '6px' }}>
                      <div style={{
                        width: `${pct}%`, height: '6px', borderRadius: '99px',
                        background: COLORES[i % COLORES.length],
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tabla histórica */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>📋 Tabla histórica</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Mes', 'Ingresos', 'Presupuesto', 'Gastos reales', ...(hayExtraordinarios ? ['⭐ Normal'] : []), 'Ahorro real', 'Tasa'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'right', color: h === '⭐ Normal' ? 'var(--yellow)' : 'var(--text2)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meses.map(m => {
                const gastosReal = txPorMes[m.mes] || 0
                const ahorro = Number(m.ingresos_estimados) - gastosReal
                const tasa = Number(m.ingresos_estimados) > 0
                  ? ((ahorro / Number(m.ingresos_estimados)) * 100).toFixed(1)
                  : 0
                const sobrePresupuesto = gastosReal > Number(m.presupuesto_gastos)
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{m.mes}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--green)', fontWeight: '600' }}>{fmt(m.ingresos_estimados)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text2)' }}>{fmt(m.presupuesto_gastos)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: sobrePresupuesto ? 'var(--red)' : 'var(--yellow)', fontWeight: '600' }}>{fmt(gastosReal)}</td>
                    {hayExtraordinarios && (
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--yellow)', fontWeight: '600' }}>
                        {fmt(txNormPorMes[m.mes] ?? gastosReal)}
                      </td>
                    )}
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