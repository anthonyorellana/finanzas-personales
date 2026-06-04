import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCicloFechas, fmtDia } from '../lib/ciclo'
import { ART } from '../lib/objetivosArt'

const fmt = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR',
    maximumFractionDigits: 0 }).format(Math.round(n))

function barraASCII(pct, ancho = 20) {
  const c = Math.min(Math.max(pct, 0), 100)
  const filled = Math.round((c / 100) * ancho)
  return '[' + '█'.repeat(filled) + '░'.repeat(ancho - filled) + '] ' + Math.round(c) + '%'
}

function barraSimple(pct, ancho = 10) {
  const c = Math.min(Math.max(pct, 0), 100)
  const filled = Math.round((c / 100) * ancho)
  return '[' + '█'.repeat(filled) + '░'.repeat(ancho - filled) + ']'
}

function getBadge(pct) {
  if (pct >= 100) return 'DONE'
  if (pct >= 70)  return 'CASI'
  if (pct >= 40)  return 'EN CURSO'
  return 'INICIO'
}

function badgeColor(badge) {
  if (badge === 'DONE')     return 'var(--term-green)'
  if (badge === 'CASI')     return 'var(--term-green)'
  if (badge === 'EN CURSO') return 'var(--term-dim)'
  return 'var(--term-amber)' // INICIO
}

function sep(label, count, width = 50) {
  const inner = count != null ? `${label} [${count}]` : label
  const line = `── ${inner} `
  return line + '─'.repeat(Math.max(0, width - line.length))
}

const OBJETIVOS = [
  { id: 'colchon_completo', nombre: 'Colchón completo',
    subtitulo: 'fondo de emergencia · 6 meses de gastos',
    meta: 7500,  actualKey: 'trLiquidez', ritmoKey: 'colchon'    },
  { id: 'primera_meta_inv', nombre: 'Primera meta · inversiones',
    subtitulo: 'cartera ETF en Trade Republic',
    meta: 1000,  actualKey: 'etfs',       ritmoKey: 'etfs'       },
  { id: 'patrimonio_10k',   nombre: 'Patrimonio 10.000 €',
    subtitulo: 'net worth total · todas las cuentas',
    meta: 10000, actualKey: 'patrimonio', ritmoKey: 'patrimonio' },
  { id: 'patrimonio_25k',   nombre: 'Patrimonio 25.000 €',
    subtitulo: 'objetivo a largo plazo',
    meta: 25000, actualKey: 'patrimonio', ritmoKey: 'patrimonio' },
]

export default function Objetivos() {
  const [cuentas, setCuentas]   = useState([])
  const [meses, setMeses]       = useState([])
  const [fijos, setFijos]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 769)

  useEffect(() => {
    load()
    const h = () => setIsNarrow(window.innerWidth < 769)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  async function load() {
    const [{ data: c }, { data: m }, { data: f }] = await Promise.all([
      supabase.from('cuentas').select('*'),
      supabase.from('meses').select('*').order('mes'),
      supabase.from('gastos_fijos').select('*').eq('activo', true),
    ])
    setCuentas(c || [])
    setMeses(m || [])
    setFijos(f || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ fontFamily: 'var(--term-font)', color: 'var(--term-green)',
                  padding: '24px 16px', background: 'var(--term-bg)', minHeight: '100vh' }}>
      <div>ant@finanzas:~/finanzas/objetivos $ status --all</div>
      <div style={{ marginTop: '8px', color: 'var(--term-dim)' }}>loading...</div>
    </div>
  )

  const trLiquidez  = Number(cuentas.find(c => c.nombre === 'TR — Liquidez')?.saldo || 0)
  const etfs        = cuentas.filter(c => c.tipo === 'etf').reduce((s, c) => s + Number(c.saldo), 0)
  const patrimonio  = cuentas.reduce((s, c) => s + Number(c.saldo), 0)

  const mesNatural     = new Date().toLocaleString('es-ES', { month: 'short', year: 'numeric' })
    .replace('.', '').replace(/^\w/, c => c.toUpperCase())
  const mesActual      = meses.find(m => m.mes === mesNatural) || meses[meses.length - 1]
  const ahorroObjetivo = Number(mesActual?.ahorro_objetivo || 0)
  const aportadoETFsMes = fijos.filter(f => f.es_inversion).reduce((s, f) => s + Number(f.importe), 0)
  const ritmoTotal     = ahorroObjetivo + aportadoETFsMes
  const tasaAhorro     = mesActual && Number(mesActual.ingresos_estimados) > 0
    ? (ritmoTotal / Number(mesActual.ingresos_estimados)) * 100 : 0

  const { inicio: cicloInicio, fin: cicloFin } = getCicloFechas(0)
  const hoy        = new Date()
  const totalDias  = Math.round((cicloFin - cicloInicio) / 86400000) + 1
  const diaEnCiclo = Math.min(Math.round((hoy - cicloInicio) / 86400000) + 1, totalDias)

  const actualesMap = { trLiquidez, etfs, patrimonio }
  const ritmosMap   = { colchon: ahorroObjetivo, etfs: aportadoETFsMes, patrimonio: ritmoTotal }

  const objetivosCalc = OBJETIVOS.map(obj => {
    const actual     = actualesMap[obj.actualKey] || 0
    const ritmoValor = ritmosMap[obj.ritmoKey] || 0
    const pct        = Math.min((actual / obj.meta) * 100, 100)
    const falta      = Math.max(obj.meta - actual, 0)
    const cumplido   = falta <= 0
    const badge      = getBadge(pct)
    const ciclosRestantes = (!cumplido && ritmoValor > 0) ? Math.ceil(falta / ritmoValor) : null
    const fechaETA = ciclosRestantes != null ? (() => {
      const d = new Date()
      d.setDate(d.getDate() + ciclosRestantes * 31)
      return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
        .replace('.', '').replace(/^\w/, c => c.toUpperCase())
    })() : null
    return { ...obj, actual, ritmoValor, pct, falta, cumplido, badge, ciclosRestantes, fechaETA }
  })

  const activosCount     = objetivosCalc.filter(o => !o.cumplido).length
  const completadosCount = objetivosCalc.filter(o => o.cumplido).length
  const barAncho         = isNarrow ? 12 : 20
  const sepWidth         = isNarrow ? 36 : 50

  const s = {
    dim:   { color: 'var(--term-dim)' },
    green: { color: 'var(--term-green)' },
    white: { color: 'var(--term-text)' },
    amber: { color: 'var(--term-amber)' },
  }

  return (
    <div style={{ fontFamily: 'var(--term-font)', color: 'var(--term-text)',
                  background: 'var(--term-bg)', padding: '24px 16px', minHeight: '100vh',
                  fontSize: isNarrow ? '12px' : '14px', maxWidth: '860px', marginInline: 'auto' }}>

      {/* Prompt cabecera */}
      <div style={{ ...s.green, marginBottom: '20px' }}>
        ant@finanzas:~/finanzas/objetivos $ status --all
      </div>

      {/* Bloque sistema */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ ...s.white, marginBottom: '4px' }}>ant@finanzas</div>
        <div style={{ ...s.dim, marginBottom: '8px' }}>{'─'.repeat(isNarrow ? 32 : 44)}</div>
        {[
          ['sistema',     'FinanzOS 2.6 · savings-kernel'],
          ['ciclo',       `${fmtDia(cicloInicio)} → ${fmtDia(cicloFin)} · día ${diaEnCiclo}/${totalDias}`],
          ['patrimonio',  `${fmt(patrimonio)} / ${fmt(25000)}`],
          ['tasa ahorro', `${Math.round(tasaAhorro)}% ${barraSimple(tasaAhorro, 10)}`],
          ['ritmo',       `+${fmt(ritmoTotal)}/ciclo (ahorro + inversión)`],
          ['objetivos',   `${activosCount} activos · ${completadosCount} completados`],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'grid',
                                     gridTemplateColumns: isNarrow ? '90px 1fr' : '110px 1fr',
                                     gap: '12px', marginBottom: '3px' }}>
            <span style={s.dim}>{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>

      {/* Separador activos */}
      <div style={{ ...s.green, opacity: 0.7, marginBottom: '20px' }}>
        {sep('OBJETIVOS ACTIVOS', activosCount, sepWidth)}
      </div>

      {/* Objetivos activos */}
      {objetivosCalc.filter(o => !o.cumplido).map(o => (
        <div key={o.id} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '28px' }}>
          {/* Arte ASCII lateral — solo escritorio */}
          {!isNarrow && ART[o.id] && (
            <pre style={{
              color: 'rgba(51,255,102,0.35)',
              fontSize: '7px',
              lineHeight: '1.15',
              margin: 0,
              flexShrink: 0,
              userSelect: 'none',
              whiteSpace: 'pre',
              fontFamily: 'var(--term-font)',
            }}>
              {ART[o.id].trim()}
            </pre>
          )}
          {/* Contenido del objetivo */}
          <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: '2px' }}>
            <span style={s.green}>▸ {o.id}</span>
            <span style={s.dim}> — </span>
            <span style={s.white}>{o.nombre}</span>
            {' '}
            <span style={{
              border: `1px solid ${badgeColor(o.badge)}`,
              padding: '0px 6px',
              borderRadius: '2px',
              fontSize: '11px',
              marginLeft: '8px',
              color: badgeColor(o.badge),
            }}>
              {o.badge}
            </span>
          </div>
          <div style={{ ...s.dim, marginBottom: '4px' }}>{o.subtitulo}</div>
          <div style={{ ...s.green, marginBottom: '4px' }}>{barraASCII(o.pct, barAncho)}</div>
          <div style={{ ...s.dim, marginBottom: '2px' }}>
            {'actual '}<span style={s.white}>{fmt(o.actual)}</span>
            {' · meta '}<span style={s.white}>{fmt(o.meta)}</span>
            {' · faltan '}<span style={s.amber}>{fmt(o.falta)}</span>
          </div>
          <div style={s.dim}>
            {o.ciclosRestantes != null ? (
              <>
                {'eta '}<span style={s.green}>{o.fechaETA}</span>
                {' · ritmo '}<span style={s.white}>+{fmt(o.ritmoValor)}/ciclo</span>
                {' · ~'}<span style={s.white}>{o.ciclosRestantes}</span>{' ciclos'}
              </>
            ) : 'sin ritmo positivo actualmente'}
          </div>
          </div>{/* fin contenido */}
        </div>
      ))}

      {/* Completados */}
      {completadosCount > 0 && (
        <>
          <div style={{ ...s.green, opacity: 0.7, marginBottom: '12px', marginTop: '4px' }}>
            {sep('COMPLETADOS', completadosCount, sepWidth)}
          </div>
          {objetivosCalc.filter(o => o.cumplido).map(o => (
            <div key={o.id} style={{ ...s.dim, marginBottom: '6px', opacity: 0.65 }}>
              {'✓ '}
              <span style={{ color: 'rgba(51,255,102,0.6)' }}>{o.id}</span>
              {` — ${o.nombre} · ${fmt(o.actual)} / ${fmt(o.meta)} · `}
              <span style={s.green}>DONE</span>
            </div>
          ))}
          <div style={{ marginBottom: '16px' }} />
        </>
      )}

      {/* Prompt final con cursor parpadeante */}
      <div style={{ ...s.green, marginTop: '8px' }}>
        {'ant@finanzas:~/finanzas/objetivos $ '}<span className="term-cursor">█</span>
      </div>
    </div>
  )
}
