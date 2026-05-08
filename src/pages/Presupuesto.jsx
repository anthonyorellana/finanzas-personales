import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

export default function Presupuesto() {
  const [meses, setMeses] = useState([])
  const [mesActual, setMesActual] = useState(null)
  const [fijos, setFijos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMes, setEditMes] = useState(false)
  const [showNuevoMes, setShowNuevoMes] = useState(false)
  const [editFijo, setEditFijo] = useState(null)
  const [editFijoVal, setEditFijoVal] = useState('')
  const [formMes, setFormMes] = useState({ ingresos_estimados: '', presupuesto_gastos: '' })
  const [formNuevo, setFormNuevo] = useState({ mes: '', ingresos_estimados: '', presupuesto_gastos: '', notas: '' })
  const [gastoReal, setGastoReal] = useState(0)
  const [gastoManual, setGastoManual] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: m }, { data: f }] = await Promise.all([
      supabase.from('meses').select('*').order('mes'),
      supabase.from('gastos_fijos').select('*').eq('activo', true),
    ])
    const lista = m || []
    setMeses(lista)
    setFijos(f || [])

    const mesHoy = new Date().toLocaleString('es-ES', { month: 'short', year: 'numeric' })
      .replace('.', '').replace(/^\w/, c => c.toUpperCase())
    const actual = lista.find(m => m.mes === mesHoy) || lista[lista.length - 1]
    setMesActual(actual)
    if (actual) {
      setFormMes({ ingresos_estimados: actual.ingresos_estimados, presupuesto_gastos: actual.presupuesto_gastos })
      await cargarGastoReal(actual.mes)
    }
    setLoading(false)
  }

  async function cargarGastoReal(mes) {
    const { data } = await supabase
      .from('transacciones')
      .select('importe, tipo')
      .eq('mes', mes)
    const total = (data || [])
      .filter(t => t.tipo === '⬇ Gasto')
      .reduce((s, t) => s + Math.abs(t.importe), 0)
    setGastoReal(total)
    setGastoManual('')
  }

  async function seleccionarMes(id) {
    const m = meses.find(m => m.id === id)
    setMesActual(m)
    setFormMes({ ingresos_estimados: m.ingresos_estimados, presupuesto_gastos: m.presupuesto_gastos })
    await cargarGastoReal(m.mes)
  }

  async function actualizarMes() {
    if (!mesActual) return
    setSaving(true)
    await supabase.from('meses').update({
      ingresos_estimados: Number(formMes.ingresos_estimados),
      presupuesto_gastos: Number(formMes.presupuesto_gastos),
    }).eq('id', mesActual.id)
    setSaving(false)
    setEditMes(false)
    load()
  }

  async function crearMes() {
    if (!formNuevo.mes || !formNuevo.ingresos_estimados || !formNuevo.presupuesto_gastos) return
    setSaving(true)
    await supabase.from('meses').insert([{
      mes: formNuevo.mes,
      ingresos_estimados: Number(formNuevo.ingresos_estimados),
      presupuesto_gastos: Number(formNuevo.presupuesto_gastos),
      notas: formNuevo.notas || null,
    }])
    setFormNuevo({ mes: '', ingresos_estimados: '', presupuesto_gastos: '', notas: '' })
    setShowNuevoMes(false)
    setSaving(false)
    load()
  }

  async function guardarFijo() {
    if (!editFijo) return
    await supabase.from('gastos_fijos').update({ importe: Number(editFijoVal) }).eq('id', editFijo.id)
    setEditFijo(null)
    setEditFijoVal('')
    load()
  }

  if (loading) return <div style={{ color: 'var(--text2)', padding: '40px' }}>Cargando...</div>

  const totalFijos = fijos.reduce((s, f) => s + Number(f.importe), 0)
  const presupuesto = mesActual?.presupuesto_gastos || 0
  const ingresos = mesActual?.ingresos_estimados || 0
  const paraInvertir = ingresos - presupuesto
  const gastoEfectivo = gastoManual !== '' ? Number(gastoManual) : gastoReal
  const disponible = presupuesto - gastoEfectivo
  const pctGastado = presupuesto > 0 ? Math.min((gastoEfectivo / presupuesto) * 100, 100) : 0

  const hoy = new Date()
  const diaActual = hoy.getDate()
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  const proyeccion = diaActual > 0 ? (gastoEfectivo / diaActual) * diasMes : 0
  const desviacion = proyeccion - presupuesto

  return (
    <div style={{ maxWidth: '700px' }}>
      {editFijo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 100, padding: '20px',
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '320px',
          }}>
            <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>
              ✏️ {editFijo.emoji} {editFijo.nombre}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '16px' }}>Nuevo importe mensual</div>
            <input
              type="number" value={editFijoVal} autoFocus
              onChange={e => setEditFijoVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && guardarFijo()}
              style={{
                width: '100%', background: 'var(--bg3)', border: '2px solid var(--blue)',
                borderRadius: '10px', padding: '10px 14px', color: 'var(--text)',
                fontSize: '18px', marginBottom: '16px',
              }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={guardarFijo} style={{
                flex: 1, background: 'var(--green)', color: 'white', border: 'none',
                borderRadius: '8px', padding: '10px', cursor: 'pointer', fontWeight: '600',
              }}>Guardar</button>
              <button onClick={() => setEditFijo(null)} style={{
                flex: 1, background: 'var(--bg3)', color: 'var(--text2)',
                border: '1px solid var(--border)', borderRadius: '8px',
                padding: '10px', cursor: 'pointer',
              }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700' }}>📅 Presupuesto</h1>
        <button onClick={() => setShowNuevoMes(!showNuevoMes)} style={{
          background: 'var(--green)', color: 'white', border: 'none',
          borderRadius: '10px', padding: '10px 18px', cursor: 'pointer', fontWeight: '600',
        }}>+ Nuevo mes</button>
      </div>

      {showNuevoMes && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '20px', marginBottom: '20px',
        }}>
          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>🗓️ Nuevo mes</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Nombre del mes', key: 'mes', placeholder: 'Jun 2026' },
              { label: 'Ingresos estimados (€)', key: 'ingresos_estimados', placeholder: '1500' },
              { label: 'Presupuesto gastos (€)', key: 'presupuesto_gastos', placeholder: '823' },
              { label: 'Notas (opcional)', key: 'notas', placeholder: 'Ej: Incluye paga extra' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} style={{ flex: '1', minWidth: '150px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>{label}</div>
                <input
                  type={key === 'ingresos_estimados' || key === 'presupuesto_gastos' ? 'number' : 'text'}
                  placeholder={placeholder} value={formNuevo[key]}
                  onChange={e => setFormNuevo({ ...formNuevo, [key]: e.target.value })}
                  style={{
                    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px',
                  }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={crearMes} disabled={saving} style={{
              background: 'var(--green)', color: 'white', border: 'none',
              borderRadius: '8px', padding: '9px 20px', cursor: 'pointer', fontWeight: '600',
            }}>{saving ? 'Guardando...' : 'Crear mes'}</button>
            <button onClick={() => setShowNuevoMes(false)} style={{
              background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '9px 20px', cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </div>
      )}

      {meses.length > 1 && (
        <div style={{ marginBottom: '16px' }}>
          <select value={mesActual?.id || ''} onChange={e => seleccionarMes(e.target.value)}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px',
            }}>
            {[...meses].reverse().map(m => (
              <option key={m.id} value={m.id}>{m.mes}</option>
            ))}
          </select>
        </div>
      )}

      {mesActual && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '20px', marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>📅 {mesActual.mes}</div>
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
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--green)' }}>{fmt(ingresos)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Presupuesto</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--red)' }}>{fmt(presupuesto)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Para invertir</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--blue)' }}>{fmt(paraInvertir)}</div>
              </div>
            </div>
          )}
          {mesActual.notas && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text2)', background: 'var(--bg3)', padding: '10px', borderRadius: '8px' }}>
              {mesActual.notas}
            </div>
          )}
        </div>
      )}

      {mesActual && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '20px', marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: '600' }}>💰 Gasto real del mes</div>
            <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Auto: {fmt(gastoReal)}</div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>✏️ Corregir manualmente (opcional)</div>
            <input
              type="number"
              placeholder={`Calculado automáticamente: ${gastoReal.toFixed(2)}€`}
              value={gastoManual}
              onChange={e => setGastoManual(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg3)', border: '2px solid var(--yellow)',
                borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '16px',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text2)' }}>{fmt(gastoEfectivo)} de {fmt(presupuesto)}</span>
            <span style={{ color: pctGastado > 90 ? 'var(--red)' : 'var(--text)' }}>{pctGastado.toFixed(0)}%</span>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: '99px', height: '10px', marginBottom: '20px' }}>
            <div style={{
              width: `${pctGastado}%`, height: '10px', borderRadius: '99px',
              background: pctGastado > 90 ? 'var(--red)' : pctGastado > 70 ? 'var(--yellow)' : 'var(--green)',
              transition: 'width 0.4s ease',
            }} />
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Gastos variables</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--yellow)' }}>
                {fmt(Math.max(gastoEfectivo - totalFijos, 0))}
              </div>
            </div>
            <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Disponible</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: disponible >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(disponible)}
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg3)', borderRadius: '12px', padding: '14px',
            border: `1px solid ${desviacion > 0 ? 'var(--red)' : 'var(--green)'}`,
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>
              🎯 Proyección de cierre — día {diaActual} de {diasMes}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: desviacion > 0 ? 'var(--red)' : 'var(--green)' }}>
                {fmt(proyeccion)}
              </div>
              <div style={{ fontSize: '13px', color: desviacion > 0 ? 'var(--red)' : 'var(--green)', textAlign: 'right' }}>
                {desviacion > 0 ? `⚠️ +${fmt(desviacion)} sobre presupuesto` : `✅ ${fmt(Math.abs(desviacion))} bajo presupuesto`}
              </div>
            </div>
          </div>
        </div>
      )}

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: '600', color: 'var(--red)' }}>{fmt(f.importe)}</span>
              <button onClick={() => { setEditFijo(f); setEditFijoVal(f.importe) }} style={{
                background: 'none', border: 'none', color: 'var(--text2)',
                cursor: 'pointer', fontSize: '14px', padding: '2px',
              }}>✏️</button>
            </div>
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