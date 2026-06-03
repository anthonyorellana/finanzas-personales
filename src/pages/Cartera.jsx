import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
const AV_KEY = import.meta.env.VITE_AV_KEY

async function fetchPrecio(ticker) {
  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${AV_KEY}`
    )
    const data = await res.json()
    const precio = parseFloat(data['Global Quote']?.['05. price'])
    return isNaN(precio) ? null : precio
  } catch {
    return null
  }
}

export default function Cartera() {
  const [etfs, setEtfs] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [redondeos, setRedondeos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [actualizando, setActualizando] = useState(false)
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: e }, { data: c }, { data: r }] = await Promise.all([
      supabase.from('cartera_etfs').select('*'),
      supabase.from('cuentas').select('*'),
      supabase.from('transacciones')
        .select('importe, cuenta_id')
        .eq('tipo', '📈 Compra ETF')
        .gt('importe', 0),
    ])
    setEtfs(e || [])
    setCuentas(c || [])
    setRedondeos(r || [])
    setLoading(false)
  }

  async function sincronizarCuentas(etfsActualizados, cuentasData) {
    for (const etf of etfsActualizados) {
      const valorReal = etf.num_titulos * etf.precio_actual
      const cuenta = cuentasData.find(c => c.nombre === `TR — ${etf.ticker}`)
      if (cuenta && Math.abs(Number(cuenta.saldo) - valorReal) > 0.01) {
        await supabase.from('cuentas').update({ saldo: valorReal }).eq('id', cuenta.id)
      }
    }
  }

  async function actualizarPrecios() {
    setActualizando(true)
    const etfsActualizados = [...etfs]
    for (const etf of etfsActualizados) {
      const precio = await fetchPrecio(etf.ticker)
      if (precio) {
        await supabase.from('cartera_etfs').update({ precio_actual: precio }).eq('id', etf.id)
        etf.precio_actual = precio
      }
      await new Promise(r => setTimeout(r, 1500))
    }
    await sincronizarCuentas(etfsActualizados, cuentas)
    setUltimaActualizacion(new Date().toLocaleTimeString('es-ES'))
    setActualizando(false)
    load()
  }

  async function actualizarPrecioManual(id) {
    const nuevoPrecio = Number(editVal)
    await supabase.from('cartera_etfs').update({ precio_actual: nuevoPrecio }).eq('id', id)
    const etfsActualizados = etfs.map(e => e.id === id ? { ...e, precio_actual: nuevoPrecio } : e)
    await sincronizarCuentas(etfsActualizados, cuentas)
    setEditId(null)
    setEditVal('')
    load()
  }

  const liquidez = cuentas.find(c => c.nombre === 'TR — Liquidez')?.saldo || 0
  const totalEtfs = etfs.reduce((s, e) => s + e.num_titulos * e.precio_actual, 0)
  const totalTR = totalEtfs + Number(liquidez)

  const proyecciones = [
    { label: '1 mes', meses: 1 },
    { label: '3 meses', meses: 3 },
    { label: '6 meses', meses: 6 },
    { label: '12 meses', meses: 12 },
  ].map(({ label, meses }) => {
    const bruto = Number(liquidez) * 0.02 * (meses / 12)
    const neto = bruto * 0.81
    return { label, bruto, neto, saldo: Number(liquidez) + neto }
  })

  if (loading) return <div style={{ color: 'var(--text2)', padding: '40px' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: '800px', marginInline: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700' }}>📈 Cartera — Trade Republic</h1>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <button onClick={actualizarPrecios} disabled={actualizando} style={{
            background: actualizando ? 'var(--bg3)' : 'var(--blue)', color: 'white', border: 'none',
            borderRadius: '10px', padding: '10px 18px', cursor: actualizando ? 'not-allowed' : 'pointer',
            fontWeight: '600', fontSize: '14px',
          }}>
            {actualizando ? '⏳ Actualizando...' : '🔄 Actualizar precios'}
          </button>
          {ultimaActualizacion && (
            <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
              Última actualización: {ultimaActualizacion}
            </div>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {[
          { label: '💶 Total TR', value: fmt(totalTR), color: 'var(--green)' },
          { label: '📈 ETFs', value: fmt(totalEtfs), color: 'var(--blue)' },
          { label: '💵 Liquidez', value: fmt(liquidez), color: 'var(--purple)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: 1, minWidth: '150px', background: 'var(--bg2)',
            border: '1px solid var(--border)', borderRadius: '16px', padding: '20px',
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>{label}</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ETFs */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>📊 Posiciones ETF</div>
        {etfs.map(e => {
          const cuentaEtf = cuentas.find(c => c.nombre === `TR — ${e.ticker}`)
          const totalRedondeos = redondeos
            .filter(r => r.cuenta_id === cuentaEtf?.id)
            .reduce((s, r) => s + Number(r.importe), 0)
          const costeBase = e.num_titulos * e.precio_compra
          const costeTotal = costeBase + totalRedondeos
          const valor = e.num_titulos * e.precio_actual
          const pnl = valor - costeBase
          const pnlPct = (pnl / costeBase) * 100
          const pnlConRedondeos = valor - costeTotal
          const pnlConRedondeosPct = costeTotal > 0 ? (pnlConRedondeos / costeTotal) * 100 : 0
          return (
            <div key={e.id} style={{
              background: 'var(--bg3)', borderRadius: '12px', padding: '16px', marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '16px' }}>{e.ticker}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>{e.nombre}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '700', fontSize: '18px' }}>{fmt(valor)}</div>
                  <div style={{ fontSize: '13px', color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {pnl >= 0 ? '+' : ''}{fmt(pnl)} ({pnlPct.toFixed(2)}%)
                  </div>
                  {totalRedondeos > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>
                      +{fmt(totalRedondeos)} redondeos · real {pnlConRedondeos >= 0 ? '+' : ''}{fmt(pnlConRedondeos)} ({pnlConRedondeosPct.toFixed(2)}%)
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Títulos</div>
                  <div style={{ fontSize: '14px' }}>{e.num_titulos}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Invertido</div>
                  <div style={{ fontSize: '14px' }}>{fmt(costeTotal)}</div>
                  {totalRedondeos > 0 && (
                    <div style={{ fontSize: '10px', color: 'var(--text2)' }}>
                      ({fmt(costeBase)} + {fmt(totalRedondeos)} redondeos)
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)' }}>P. Actual</div>
                  {editId === e.id ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="number" value={editVal} onChange={ev => setEditVal(ev.target.value)}
                        style={{
                          width: '80px', background: 'var(--bg2)', border: '1px solid var(--blue)',
                          borderRadius: '6px', padding: '4px 8px', color: 'var(--text)', fontSize: '13px',
                        }} />
                      <button onClick={() => actualizarPrecioManual(e.id)} style={{
                        background: 'var(--green)', color: 'white', border: 'none',
                        borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px',
                      }}>✓</button>
                      <button onClick={() => setEditId(null)} style={{
                        background: 'var(--bg3)', color: 'var(--text2)', border: 'none',
                        borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px',
                      }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px' }}>{fmt(e.precio_actual)}</span>
                      <button onClick={() => { setEditId(e.id); setEditVal(e.precio_actual) }} style={{
                        background: 'none', border: 'none', color: 'var(--text2)',
                        cursor: 'pointer', fontSize: '12px',
                      }}>✏️</button>
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Objetivo</div>
                  <div style={{ fontSize: '14px' }}>{(e.objetivo_pct * 100).toFixed(0)}%</div>
                </div>
              </div>
              {e.notas && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text2)' }}>{e.notas}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Proyección intereses */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>
          💸 Proyección intereses liquidez (2% TAE, retención 19%)
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {proyecciones.map(({ label, bruto, neto, saldo }) => (
            <div key={label} style={{
              flex: 1, minWidth: '130px', background: 'var(--bg3)',
              borderRadius: '12px', padding: '14px',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px' }}>{label}</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--green)' }}>+{fmt(neto)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>Bruto: {fmt(bruto)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Saldo est.: {fmt(saldo)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
