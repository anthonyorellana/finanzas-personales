import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
const OBJETIVOS = { santander: 1100, trLiquidez: 7500, etfs: 730 }

export default function Dashboard() {
  const [cuentas, setCuentas] = useState([])
  const [meses, setMeses] = useState([])
  const [etfsList, setEtfsList] = useState([])
  const [fijos, setFijos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editCuenta, setEditCuenta] = useState(null)
  const [editSaldo, setEditSaldo] = useState('')
  const [saving, setSaving] = useState(false)
  const [guardandoSnap, setGuardandoSnap] = useState(false)
  const [snapOk, setSnapOk] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: c }, { data: m }, { data: e }, { data: f }] = await Promise.all([
      supabase.from('cuentas').select('*'),
      supabase.from('meses').select('*'),
      supabase.from('cartera_etfs').select('*'),
      supabase.from('gastos_fijos').select('*').eq('activo', true),
    ])
    setCuentas(c || [])
    setMeses(m || [])
    setEtfsList(e || [])
    setFijos(f || [])
    setLoading(false)
  }

  async function guardarSnapshot() {
    setGuardandoSnap(true)
    const total = cuentas.reduce((s, c) => s + Number(c.saldo), 0)
    const detalle = {}
    cuentas.forEach(c => { detalle[c.nombre] = Number(c.saldo) })
    const hoy = new Date()
    const fecha = hoy.toISOString().split('T')[0]
    const mes = hoy.toLocaleString('es-ES', { month: 'short', year: 'numeric' })
      .replace('.', '').replace(/^\w/, c => c.toUpperCase())
    await supabase.from('snapshots_patrimonio').upsert([{ fecha, mes, total, detalle }], { onConflict: 'mes' })
    setGuardandoSnap(false)
    setSnapOk(true)
    setTimeout(() => setSnapOk(false), 3000)
  }

  async function guardarSaldo() {
    if (!editCuenta) return
    setSaving(true)
    const nuevoSaldo = Number(editSaldo)
    await supabase.from('cuentas').update({ saldo: nuevoSaldo }).eq('id', editCuenta.id)

    // Si es cuenta ETF, recalcula precio_actual en cartera_etfs
    if (editCuenta.tipo === 'etf') {
      const ticker = editCuenta.nombre.replace('TR — ', '')
      const etf = etfsList.find(e => e.ticker === ticker)
      if (etf && etf.num_titulos > 0) {
        const nuevoPrecio = nuevoSaldo / etf.num_titulos
        await supabase.from('cartera_etfs').update({ precio_actual: nuevoPrecio }).eq('id', etf.id)
      }
    }

    setSaving(false)
    setEditCuenta(null)
    setEditSaldo('')
    load()
  }

  const patrimonio = cuentas.reduce((s, c) => s + Number(c.saldo), 0)
  const santander = cuentas.find(c => c.nombre === 'Santander')?.saldo || 0
  const trLiquidez = cuentas.find(c => c.nombre === 'TR — Liquidez')?.saldo || 0
  const etfs = cuentas.filter(c => c.tipo === 'etf').reduce((s, c) => s + Number(c.saldo), 0)

  const mesNaturalActual = new Date().toLocaleString('es-ES', { month: 'short', year: 'numeric' })
    .replace('.', '').replace(/^\w/, c => c.toUpperCase())
  const mesActual = meses.find(m => m.mes === mesNaturalActual) || meses[meses.length - 1]
  const aportadoETFs = fijos.filter(f => f.es_inversion).reduce((s, f) => s + Number(f.importe), 0)
  const ahorroColchon = mesActual
    ? Number(mesActual.ingresos_estimados) - Number(mesActual.presupuesto_gastos) - aportadoETFs
    : 0
  const tasaAhorro = mesActual && Number(mesActual.ingresos_estimados) > 0
    ? (ahorroColchon / Number(mesActual.ingresos_estimados) * 100).toFixed(1)
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

      {/* Modal editar saldo */}
      {editCuenta && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '28px', width: '320px',
          }}>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
              ✏️ Editar saldo
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '20px' }}>
              {editCuenta.nombre}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>Nuevo saldo (€)</div>
            <input
              type="number"
              value={editSaldo}
              onChange={e => setEditSaldo(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && guardarSaldo()}
              style={{
                width: '100%', background: 'var(--bg3)', border: '2px solid var(--blue)',
                borderRadius: '10px', padding: '10px 14px', color: 'var(--text)',
                fontSize: '18px', marginBottom: '20px',
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={guardarSaldo} disabled={saving} style={{
                flex: 1, background: 'var(--green)', color: 'white', border: 'none',
                borderRadius: '8px', padding: '10px', cursor: 'pointer', fontWeight: '600',
              }}>{saving ? 'Guardando...' : 'Guardar'}</button>
              <button onClick={() => { setEditCuenta(null); setEditSaldo('') }} style={{
                flex: 1, background: 'var(--bg3)', color: 'var(--text2)',
                border: '1px solid var(--border)', borderRadius: '8px',
                padding: '10px', cursor: 'pointer',
              }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas principales */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px', maxWidth: '900px' }}>
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '20px', flex: '1', minWidth: '200px',
        }}>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>💶 Patrimonio Total</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--green)' }}>{fmt(patrimonio)}</div>
        </div>
        {cuentas.map(c => (
          <div key={c.id} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '20px', flex: '1', minWidth: '200px',
            position: 'relative',
          }}>
            <button
              onClick={() => { setEditCuenta(c); setEditSaldo(c.saldo) }}
              style={{
                position: 'absolute', top: '12px', right: '12px',
                background: 'none', border: 'none', color: 'var(--text2)',
                cursor: 'pointer', fontSize: '14px', padding: '2px',
              }}
              title="Editar saldo"
            >✏️</button>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>
              {c.tipo === 'corriente' ? '🏦' : c.tipo === 'liquidez' ? '📱' : '📈'} {c.nombre}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700' }}>{fmt(c.saldo)}</div>
            {c.notas && <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>{c.notas}</div>}
          </div>
        ))}
      </div>

      {/* Snapshot patrimonio */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-8px', marginBottom: '24px' }}>
        <button onClick={guardarSnapshot} disabled={guardandoSnap} style={{
          background: snapOk ? 'var(--green)' : 'var(--bg2)',
          color: snapOk ? 'white' : 'var(--text2)',
          border: '1px solid var(--border)', borderRadius: '10px',
          padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
          transition: 'all 0.3s ease',
        }}>
          {snapOk ? '✅ Snapshot guardado' : guardandoSnap ? 'Guardando...' : '📸 Guardar snapshot del mes'}
        </button>
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
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>📈 Aportado a ETFs</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--blue)' }}>{fmt(aportadoETFs)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>💾 Ahorro al colchón</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: ahorroColchon >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(ahorroColchon)}
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
          { label: '🏦 Santander', actual: santander, objetivo: OBJETIVOS.santander },
          { label: '📱 TR Liquidez', actual: trLiquidez, objetivo: OBJETIVOS.trLiquidez },
          { label: '📈 ETFs', actual: etfs, objetivo: OBJETIVOS.etfs },
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