import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCicloFechas } from '../lib/ciclo'
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

const METAS = [
  { nombre: 'Colchón completo',         actual: 'trLiquidez', objetivo: 7500,  icono: '🛟', ritmo: 'colchon'    },
  { nombre: 'Primera meta inversiones', actual: 'etfs',       objetivo: 1000,  icono: '📈', ritmo: 'etfs'       },
  { nombre: 'Patrimonio 10k',           actual: 'patrimonio', objetivo: 10000, icono: '💰', ritmo: 'patrimonio' },
  { nombre: 'Patrimonio 25k',           actual: 'patrimonio', objetivo: 25000, icono: '🎯', ritmo: 'patrimonio' },
]

const COLORES = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
  '#a855f7', '#eab308', '#64748b', '#10b981', '#6366f1',
]

export default function Analisis() {
  const [transacciones, setTransacciones] = useState([])
  const [categorias, setCategorias] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: t }, { data: c }, { data: s }, { data: cu }] = await Promise.all([
      supabase.from('transacciones').select('*, cuentas(tipo, nombre)').order('fecha', { ascending: false }),
      supabase.from('categorias').select('*'),
      supabase.from('snapshots_patrimonio').select('*').order('fecha'),
      supabase.from('cuentas').select('nombre, tipo, saldo'),
    ])
    setTransacciones(t || [])
    setCategorias(c || [])
    setSnapshots(s || [])
    setCuentas(cu || [])
    setLoading(false)
  }

  const cuentasTipoMap = Object.fromEntries(cuentas.map(c => [c.nombre, c.tipo]))

  const datosSnaps = snapshots.map(s => {
    let diaDia = 0, colchon = 0, inversiones = 0
    Object.entries(s.detalle || {}).forEach(([nombre, saldo]) => {
      const tipo = cuentasTipoMap[nombre]
      if (tipo === 'corriente') diaDia += Number(saldo)
      else if (tipo === 'liquidez') colchon += Number(saldo)
      else if (tipo === 'etf') inversiones += Number(saldo)
    })
    return {
      mes: s.mes.replace(' 2025', '').replace(' 2026', ''),
      Total: s.total,
      'Día a día': diaDia,
      'Colchón': colchon,
      'Inversiones': inversiones,
      detalle: s.detalle,
    }
  })

  const toYMD = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const datosCiclos = []
  for (let offset = -11; offset <= 0; offset++) {
    const { inicio, fin } = getCicloFechas(offset)
    const ini = toYMD(inicio), finS = toYMD(fin)
    const txC = transacciones.filter(t => t.fecha >= ini && t.fecha <= finS)

    const ingresosCiclo = txC
      .filter(t => t.tipo === '⬆ Ingreso' && t.cuentas?.tipo === 'corriente')
      .reduce((s, t) => s + Number(t.importe), 0)
    const gastosArr = txC.filter(t => t.tipo === '⬇ Gasto')
    const gastosCiclo = gastosArr.reduce((s, t) => s + Math.abs(Number(t.importe)), 0)
    const aportadoETFs = txC
      .filter(t => t.tipo === '📈 Compra ETF' &&
        (t.cuentas?.tipo === 'liquidez' || t.cuentas?.tipo === 'corriente'))
      .reduce((s, t) => s + Math.abs(Number(t.importe)), 0)
    const redondeosETFs = txC
      .filter(t => t.tipo === '📈 Compra ETF' && t.cuentas?.tipo === 'etf')
      .reduce((s, t) => s + Math.abs(Number(t.importe)), 0)
    const ahorroColchon = ingresosCiclo - gastosCiclo - aportadoETFs
    const tasaAhorro = ingresosCiclo > 0 ? (ahorroColchon / ingresosCiclo) * 100 : 0

    if (ingresosCiclo === 0 || gastosArr.length < 5) continue

    datosCiclos.push({
      label: `${inicio.getDate()}/${inicio.getMonth() + 1}`,
      ingresosCiclo,
      'Gastos reales': gastosCiclo,
      'Ahorro real': ahorroColchon,
      aportadoETFs,
      redondeosETFs,
      tasaAhorro,
    })
  }

  // Saldos actuales desde cuentas
  const trLiquidez   = cuentas.filter(c => c.tipo === 'liquidez').reduce((s, c) => s + Number(c.saldo), 0)
  const etfs         = cuentas.filter(c => c.tipo === 'etf').reduce((s, c) => s + Number(c.saldo), 0)
  const patrimonio   = cuentas.reduce((s, c) => s + Number(c.saldo), 0)

  // Ritmos sobre los últimos 3 ciclos válidos
  const ultimos3 = datosCiclos.slice(-3)
  const media = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
  const ritmoColchon    = Math.max(media(ultimos3.map(c => c['Ahorro real'])), 0)
  const ritmoETFs       = media(ultimos3.map(c => c.aportadoETFs))
  const ritmoPatrimonio = ritmoColchon + ritmoETFs

  const saldosActualesMap = { trLiquidez, etfs, patrimonio }
  const ritmosMap = { colchon: ritmoColchon, etfs: ritmoETFs, patrimonio: ritmoPatrimonio }

  const predicciones = METAS.map(meta => {
    const actual = saldosActualesMap[meta.actual] || 0
    const ritmoValor = ritmosMap[meta.ritmo] || 0
    const falta = meta.objetivo - actual
    const cumplida = falta <= 0
    const ciclosRestantes = (!cumplida && ritmoValor > 0) ? Math.ceil(falta / ritmoValor) : null
    const fechaEstimada = ciclosRestantes != null ? (() => {
      const d = new Date()
      d.setDate(d.getDate() + ciclosRestantes * 31)
      return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
        .replace('.', '').replace(/^\w/, c => c.toUpperCase())
    })() : null
    return { ...meta, actual, falta, cumplida, ritmoValor, ciclosRestantes, fechaEstimada }
  })

  const totalIngresos = datosCiclos.reduce((s, c) => s + c.ingresosCiclo, 0)
  const totalGastos   = datosCiclos.reduce((s, c) => s + c['Gastos reales'], 0)
  const totalColchon  = datosCiclos.reduce((s, c) => s + c['Ahorro real'], 0)
  const totalETFs      = datosCiclos.reduce((s, c) => s + c.aportadoETFs, 0)
  const totalRedondeos = datosCiclos.reduce((s, c) => s + c.redondeosETFs, 0)
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
    <div style={{ maxWidth: '900px', marginInline: 'auto' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '24px' }}>📉 Análisis Histórico</h1>

      {/* Resumen total */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {[
          { label: '💰 Ingresos',           value: fmt(totalIngresos), color: 'var(--green)'  },
          { label: '💸 Gastos',             value: fmt(totalGastos),   color: 'var(--red)'    },
          { label: '💾 Aportado al colchón', value: fmt(totalColchon),  color: 'var(--blue)'  },
          { label: '📈 Aportaciones ETF',   value: fmt(totalETFs),      color: 'var(--purple)' },
          { label: '🔁 Redondeos ETF',      value: fmt(totalRedondeos), color: 'var(--text2)'  },
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

      {/* Predicciones */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '15px', fontWeight: '600' }}>🔮 Predicciones</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)', maxWidth: '380px', textAlign: 'right', lineHeight: '1.5' }}>
            Estimaciones basadas en el ritmo de los últimos {ultimos3.length} ciclos.
            La realidad puede variar según ingresos y gastos futuros.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {predicciones.map(meta => {
            const pct = Math.min((meta.actual / meta.objetivo) * 100, 100)
            return (
              <div key={meta.nombre} style={{
                background: 'var(--bg3)', borderRadius: '12px', padding: '16px',
                opacity: meta.cumplida ? 0.6 : 1,
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{meta.icono}</div>
                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>{meta.nombre}</div>
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px' }}>
                  {fmt(meta.actual)} / {fmt(meta.objetivo)}
                </div>
                <div style={{ background: 'var(--bg2)', borderRadius: '99px', height: '5px', marginBottom: '12px' }}>
                  <div style={{
                    width: `${pct}%`, height: '5px', borderRadius: '99px',
                    background: meta.cumplida ? 'var(--green)' : 'var(--blue)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                {meta.cumplida ? (
                  <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--green)' }}>✅ Cumplida</div>
                ) : meta.ritmoValor > 0 ? (
                  <>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--blue)' }}>
                      {meta.fechaEstimada}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>
                      ~{meta.ciclosRestantes} ciclos · {fmt(meta.ritmoValor)}/ciclo
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
                    Sin ritmo positivo actualmente
                  </div>
                )}
              </div>
            )
          })}
        </div>
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
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={datosSnaps} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradDiaDia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradColchon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradInversiones" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(1)}k€`} />
              <Tooltip content={<TooltipPatrimonio />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="Día a día"   stackId="1" stroke="#22c55e" strokeWidth={2} fill="url(#gradDiaDia)" />
              <Area type="monotone" dataKey="Colchón"     stackId="1" stroke="#3b82f6" strokeWidth={2} fill="url(#gradColchon)" />
              <Area type="monotone" dataKey="Inversiones" stackId="1" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradInversiones)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '10px', textAlign: 'center' }}>
          Guarda un snapshot al final de cada ciclo desde el Dashboard para enriquecer esta gráfica
        </div>
      </div>

      {/* Aportaciones por ciclo */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>💾 Aportaciones por ciclo</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={datosCiclos} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: '13px' }} />
            <Bar dataKey="Ahorro real" name="Colchón" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="aportadoETFs" name="ETFs" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico barras ingresos vs gastos */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>📊 Presupuesto vs Gastos reales</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={datosCiclos} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} />
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
          <LineChart data={datosCiclos} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: '#8b8fa8', fontSize: 11 }} axisLine={false} tickLine={false} />
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
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>📋 Tabla histórica por ciclo</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Ciclo', 'Ingresos', 'Gastos', '📈 ETFs', 'Colchón', 'Tasa'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text2)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datosCiclos.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{c.label}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--green)', fontWeight: '600' }}>{fmt(c.ingresosCiclo)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--yellow)', fontWeight: '600' }}>{fmt(c['Gastos reales'])}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--purple)', fontWeight: '600' }}>{fmt(c.aportadoETFs)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: c['Ahorro real'] >= 0 ? 'var(--blue)' : 'var(--red)', fontWeight: '600' }}>{fmt(c['Ahorro real'])}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: c.tasaAhorro >= 0 ? 'var(--green)' : 'var(--red)' }}>{c.tasaAhorro.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '12px', textAlign: 'center' }}>
          Se omiten ciclos con datos incompletos (sin ingresos registrados o menos de 5 gastos)
        </div>
      </div>
    </div>
  )
}