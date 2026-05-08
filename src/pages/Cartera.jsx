import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
const fmtPct = (n) => `${(n * 100).toFixed(2)}%`

export default function Cartera() {
  const [etfs, setEtfs] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from('cartera_etfs').select('*'),
      supabase.from('cuentas').select('*'),
    ])
    setEtfs(e || [])
    setCuentas(c || [])
    setLoading(false)
  }

  async function actualizarPrecio(id) {
    await supabase.from('cartera_etfs').update({ precio_actual: Number(editVal) }).eq('id', id)
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
    <div style={{ maxWidth: '800px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '24px' }}>📈 Cartera — Trade Republic</h1>

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
          const coste = e.num_titulos * e.precio_compra
          const valor = e.num_titulos * e.precio_actual
          const pnl = valor - coste
          const pnlPct = (pnl / coste) * 100
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
                </div>
              </div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Títulos</div>
                  <div style={{ fontSize: '14px' }}>{e.num_titulos}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)' }}>P. Compra</div>
                  <div style={{ fontSize: '14px' }}>{fmt(e.precio_compra)}</div>
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
                      <button onClick={() => actualizarPrecio(e.id)} style={{
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

      {/* Proyección intereses liquidez */}
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