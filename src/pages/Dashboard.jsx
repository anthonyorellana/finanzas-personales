import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

export default function Dashboard() {
  const [cuentas, setCuentas] = useState([])
  const [meses, setMeses] = useState([])
  const [loading, setLoading] = useState(true)
  const [editCuenta, setEditCuenta] = useState(null)
  const [editSaldo, setEditSaldo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from('cuentas').select('*'),
      supabase.from('meses').select('*'),
    ])
    setCuentas(c || [])
    setMeses(m || [])
    setLoading(false)
  }

  async function guardarSaldo() {
    if (!editCuenta) return
    setSaving(true)
    await supabase.from('cuentas').update({ saldo: Number(editSaldo) }).eq('id', editCuenta.id)
    setSaving(false)
    setEditCuenta(null)
    setEditSaldo('')
    load()
  }

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
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '20px', flex: '1', minWidth: '160px',
        }}>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>💶 Patrimonio Total</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--green)' }}>{fmt(patrimonio)}</div>
        </div>
        {cuentas.map(c => (
          <div key={c.id} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '20px', flex: '1', minWidth: '160px',
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