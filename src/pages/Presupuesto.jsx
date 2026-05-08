import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

export default function Presupuesto() {
  const [mes, setMes] = useState(null)
  const [fijos, setFijos] = useState([])
  const [gastado, setGastado] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMes, setEditMes] = useState(false)
  const [formMes, setFormMes] = useState({ ingresos_estimados: '', presupuesto_gastos: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const mesActual = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase())
      .replace(' de ', ' ')

    const [{ data: m }, { data: f }] = await Promise.all([
      supabase.from('meses').select('*').ilike('mes', `%${new Date().getFullYear()}%`).order('mes'),
      supabase.from('gastos_fijos').select('*').eq('activo', true),
    ])

    const meses = m || []
    const actual = meses[meses.length - 1]
    setMes(actual)
    setFijos(f || [])
    if (actual) setFormMes({ ingresos_estimados: actual.ingresos_estimados, presupuesto_gastos: actual.presupuesto_gastos })
    setLoading(false)
  }

  async function actualizarMes() {
    if (!mes) return
    setSaving(true)
    await supabase.from('meses').update({
      ingresos_estimados: Number(formMes.ingresos_estimados),
      presupuesto_gastos: Number(formMes.presupuesto_gastos),
    }).eq('id', mes.id)
    setSaving(false)
    setEditMes(false)
    load()
  }

  if (loading) return <div style={{ color: 'var(--text2)', padding: '40px' }}>Cargando...</div>
  if (!mes) return <div style={{ color: 'var(--text2)', padding: '40px' }}>No hay datos del mes actual</div>

  const totalFijos = fijos.reduce((s, f) => s + Number(f.importe), 0)
  const gastadoNum = Number(gastado) || 0
  const variables = Math.max(gastadoNum - totalFijos, 0)
  const disponible = mes.presupuesto_gastos - gastadoNum
  const paraInvertir = mes.ingresos_estimados - mes.presupuesto_gastos
  const pctGastado = Math.min((gastadoNum / mes.presupuesto_gastos) * 100, 100)

  return (
    <div style={{ maxWidth: '700px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '24px' }}>📅 Presupuesto</h1>

      {/* Cabecera del mes */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: '600' }}>📅 {mes.mes}</div>
          <button onClick={() => setEditMes(!editMes)} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '6px 12px', color: 'var(--text2)',
            cursor: 'pointer', fontSize: '13px',
          }}>✏️ Editar</button>
        </div>

        {editMes ? (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Ingresos estimados (€)', key: 'ingresos_estimados' },
              { label: 'Presupuesto gastos (€)', key: 'presupuesto_gastos' },
            ].map(({ label, key }) => (
              <div key={key} style={{ flex: '1', minWidth: '180px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>{label}</div>
                <input type="number" value={formMes[key]}
                  onChange={e => setFormMes({ ...formMes, [key]: e.target.value })}
                  style={{
                    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px',
                  }} />
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <button onClick={actualizarMes} disabled={saving} style={{
                background: 'var(--green)', color: 'white', border: 'none',
                borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: '600',
              }}>{saving ? '...' : 'Guardar'}</button>
              <button onClick={() => setEditMes(false)} style={{
                background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '9px 16px', cursor: 'pointer',
              }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Ingresos estimados</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--green)' }}>{fmt(mes.ingresos_estimados)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Presupuesto</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--red)' }}>{fmt(mes.presupuesto_gastos)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Para invertir</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--blue)' }}>{fmt(paraInvertir)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Control de gasto actual */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>💰 ¿Cuánto llevas gastado?</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number"
            placeholder="Pega el total del extracto..."
            value={gastado}
            onChange={e => setGastado(e.target.value)}
            style={{
              flex: 1, minWidth: '200px', background: 'var(--bg3)', border: '2px solid var(--yellow)',
              borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '16px',
            }}
          />
        </div>

        {gastadoNum > 0 && (
          <div style={{ marginTop: '20px' }}>
            {/* Barra de progreso */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text2)' }}>Gasto acumulado</span>
              <span style={{ color: pctGastado > 90 ? 'var(--red)' : 'var(--text)' }}>{pctGastado.toFixed(0)}%</span>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: '99px', height: '10px', marginBottom: '20px' }}>
              <div style={{
                width: `${pctGastado}%`, height: '10px', borderRadius: '99px',
                background: pctGastado > 90 ? 'var(--red)' : pctGastado > 70 ? 'var(--yellow)' : 'var(--green)',
                transition: 'width 0.4s ease',
              }} />
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Gastos variables</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--yellow)' }}>{fmt(variables)}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Disponible hasta fin de mes</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: disponible >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {fmt(disponible)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gastos fijos */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>🔒 Gastos fijos del mes</div>
        {fijos.map(f => (
          <div key={f.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '14px' }}>{f.emoji} {f.nombre}</span>
            <span style={{ fontWeight: '600', color: 'var(--red)' }}>{fmt(f.importe)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontWeight: '700' }}>
          <span>TOTAL FIJOS</span>
          <span style={{ color: 'var(--red)' }}>{fmt(totalFijos)}</span>
        </div>
      </div>
    </div>
  )
}