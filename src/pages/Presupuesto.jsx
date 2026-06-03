import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDia = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

function getCicloFechas(offset) {
  const hoy = new Date()
  let year = hoy.getFullYear()
  let month = hoy.getMonth()
  if (hoy.getDate() < 28) {
    month -= 1
    if (month < 0) { month = 11; year -= 1 }
  }
  month += offset
  while (month < 0) { month += 12; year -= 1 }
  while (month > 11) { month -= 12; year += 1 }
  const inicio = new Date(year, month, 28)
  let ey = year, em = month + 1
  if (em > 11) { em = 0; ey += 1 }
  const fin = new Date(ey, em, 27)
  return { inicio, fin }
}

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
  const [showNuevoFijo, setShowNuevoFijo] = useState(false)
  const [formFijo, setFormFijo] = useState({ nombre: '', emoji: '💸', importe: '', es_inversion: false })
  const [formMes, setFormMes] = useState({ ingresos_estimados: '', presupuesto_gastos: '', ahorro_objetivo: '' })
  const [formNuevo, setFormNuevo] = useState({ mes: '', ingresos_estimados: '', presupuesto_gastos: '', notas: '' })
  const [cicloOffset, setCicloOffset] = useState(0)
  const [txCiclo, setTxCiclo] = useState([])
  const [loadingCiclo, setLoadingCiclo] = useState(false)

  useEffect(() => { load() }, [])
  useEffect(() => { cargarCiclo(cicloOffset) }, [cicloOffset])

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
      setFormMes({ ingresos_estimados: actual.ingresos_estimados, presupuesto_gastos: actual.presupuesto_gastos, ahorro_objetivo: actual.ahorro_objetivo || '' })
    }
    setLoading(false)
  }

  async function seleccionarMes(id) {
    const m = meses.find(m => m.id === id)
    setMesActual(m)
    setFormMes({ ingresos_estimados: m.ingresos_estimados, presupuesto_gastos: m.presupuesto_gastos, ahorro_objetivo: m.ahorro_objetivo || '' })
  }

  async function actualizarMes() {
    if (!mesActual) return
    setSaving(true)
    await supabase.from('meses').update({
      ingresos_estimados: Number(formMes.ingresos_estimados),
      presupuesto_gastos: Number(formMes.presupuesto_gastos),
      ahorro_objetivo: Number(formMes.ahorro_objetivo) || 0,
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

  async function crearFijo() {
    if (!formFijo.nombre || !formFijo.importe) return
    await supabase.from('gastos_fijos').insert([{
      nombre: formFijo.nombre,
      emoji: formFijo.emoji || '💸',
      importe: Number(formFijo.importe),
      es_inversion: formFijo.es_inversion,
      activo: true,
    }])
    setFormFijo({ nombre: '', emoji: '💸', importe: '' })
    setShowNuevoFijo(false)
    load()
  }

  async function eliminarFijo(id) {
    if (!confirm('¿Eliminar este gasto fijo?')) return
    await supabase.from('gastos_fijos').update({ activo: false }).eq('id', id)
    load()
  }

  async function togglePagadoCiclo(id, actual) {
    await supabase.from('gastos_fijos').update({ pagado_ciclo: !actual }).eq('id', id)
    load()
  }

  async function reiniciarCiclo() {
    if (!confirm('¿Reiniciar el ciclo? Se desmarcarán todos los gastos fijos como no pagados.')) return
    await supabase.from('gastos_fijos').update({ pagado_ciclo: false }).eq('activo', true)
    load()
  }

  async function cargarCiclo(offset) {
    setLoadingCiclo(true)
    const { inicio, fin } = getCicloFechas(offset)
    const inicioStr = inicio.toISOString().split('T')[0]
    const finStr = fin.toISOString().split('T')[0]
    const { data } = await supabase
      .from('transacciones')
      .select('importe, tipo, descripcion, fecha, categoria, cuentas(tipo, nombre)')
      .gte('fecha', inicioStr)
      .lte('fecha', finStr)
      .in('tipo', ['⬇ Gasto', '⬆ Ingreso'])
      .order('fecha', { ascending: false })
    setTxCiclo(data || [])
    setLoadingCiclo(false)
  }

  if (loading) return <div style={{ color: 'var(--text2)', padding: '40px' }}>Cargando...</div>

  const totalFijos = fijos.reduce((s, f) => s + Number(f.importe), 0)
  const presupuesto = mesActual?.presupuesto_gastos || 0
  const ingresos = mesActual?.ingresos_estimados || 0
  const aportadoETFsMes = fijos.filter(f => f.es_inversion).reduce((s, f) => s + Number(f.importe), 0)
  const paraInvertir = ingresos - presupuesto - aportadoETFsMes

  return (
    <div style={{ maxWidth: '700px', marginInline: 'auto' }}>
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
                { label: 'Ahorro objetivo al colchón (€)', key: 'ahorro_objetivo' },
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
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Sobrante teórico</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--blue)' }}>{fmt(paraInvertir)}</div>
              </div>
              {Number(mesActual.ahorro_objetivo) > 0 && (
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)' }}>💾 Ahorro objetivo</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--purple)' }}>{fmt(mesActual.ahorro_objetivo)}</div>
                </div>
              )}
            </div>
          )}
          {mesActual.notas && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text2)', background: 'var(--bg3)', padding: '10px', borderRadius: '8px' }}>
              {mesActual.notas}
            </div>
          )}
        </div>
      )}

      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '15px', fontWeight: '600' }}>🔒 Gastos fijos del mes</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={reiniciarCiclo} style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '5px 12px', cursor: 'pointer',
              color: 'var(--text2)', fontSize: '13px',
            }}>🔄 Reiniciar ciclo</button>
            <button onClick={() => setShowNuevoFijo(!showNuevoFijo)} style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '5px 12px', cursor: 'pointer',
              color: 'var(--text2)', fontSize: '13px',
            }}>+ Añadir</button>
          </div>
        </div>

        {showNuevoFijo && (
          <div style={{
            background: 'var(--bg3)', borderRadius: '12px', padding: '14px',
            marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end',
          }}>
            <div style={{ width: '48px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '4px' }}>Emoji</div>
              <input value={formFijo.emoji} onChange={e => setFormFijo({ ...formFijo, emoji: e.target.value })}
                style={{
                  width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '6px 8px', color: 'var(--text)', fontSize: '16px', textAlign: 'center',
                }} />
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '4px' }}>Nombre</div>
              <input placeholder="Inversión EUNL" value={formFijo.nombre}
                onChange={e => setFormFijo({ ...formFijo, nombre: e.target.value })}
                style={{
                  width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '6px 10px', color: 'var(--text)', fontSize: '14px',
                }} />
            </div>
            <div style={{ width: '100px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '4px' }}>Importe (€)</div>
              <input type="number" placeholder="300" value={formFijo.importe}
                onChange={e => setFormFijo({ ...formFijo, importe: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && crearFijo()}
                style={{
                  width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '6px 10px', color: 'var(--text)', fontSize: '14px',
                }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-end', paddingBottom: '7px' }}>
              <input type="checkbox" id="esInvFijo" checked={formFijo.es_inversion}
                onChange={e => setFormFijo({ ...formFijo, es_inversion: e.target.checked })}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              <label htmlFor="esInvFijo" style={{ fontSize: '13px', color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Es inversión (ETF)
              </label>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={crearFijo} style={{
                background: 'var(--green)', color: 'white', border: 'none',
                borderRadius: '6px', padding: '7px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
              }}>Guardar</button>
              <button onClick={() => setShowNuevoFijo(false)} style={{
                background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)',
                borderRadius: '6px', padding: '7px 14px', cursor: 'pointer', fontSize: '13px',
              }}>✕</button>
            </div>
          </div>
        )}

        {fijos.map(f => (
          <div key={f.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderBottom: '1px solid var(--border)',
            opacity: f.pagado_ciclo ? 0.5 : 1,
            transition: 'opacity 0.2s',
          }}>
            <span style={{ fontSize: '14px' }}>
              {f.pagado_ciclo && <span style={{ color: 'var(--green)', marginRight: '6px' }}>✓</span>}
              {f.emoji} {f.nombre}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: '600', color: 'var(--red)' }}>{fmt(f.importe)}</span>
              <button
                onClick={() => togglePagadoCiclo(f.id, f.pagado_ciclo)}
                title={f.pagado_ciclo ? 'Marcar como pendiente' : 'Marcar como pagado'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px' }}
              >
                {f.pagado_ciclo ? '✅' : '⬜'}
              </button>
              <button onClick={() => { setEditFijo(f); setEditFijoVal(f.importe) }} style={{
                background: 'none', border: 'none', color: 'var(--text2)',
                cursor: 'pointer', fontSize: '14px', padding: '2px',
              }}>✏️</button>
              <button onClick={() => eliminarFijo(f.id)} style={{
                background: 'none', border: 'none', color: 'var(--text2)',
                cursor: 'pointer', fontSize: '14px', padding: '2px',
              }}>🗑️</button>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontWeight: '700' }}>
          <span>TOTAL FIJOS</span>
          <span style={{ color: 'var(--red)' }}>{fmt(totalFijos)}</span>
        </div>
      </div>

      {/* Ciclo de nómina */}
      {(() => {
        const { inicio, fin } = getCicloFechas(cicloOffset)
        const hoy = new Date()
        const esCicloActual = cicloOffset === 0
        const diasTotales = Math.round((fin - inicio) / 86400000) + 1
        const diasTranscurridos = esCicloActual
          ? Math.min(Math.round((hoy - inicio) / 86400000) + 1, diasTotales)
          : diasTotales
        const diasRestantes = diasTotales - diasTranscurridos

        const ingresosCiclo = txCiclo
          .filter(t => t.tipo === '⬆ Ingreso' && t.cuentas?.tipo === 'corriente')
          .reduce((s, t) => s + Number(t.importe), 0)
        const gastosCiclo = txCiclo
          .filter(t => t.tipo === '⬇ Gasto')
          .reduce((s, t) => s + Math.abs(Number(t.importe)), 0)
        const saldoCiclo = ingresosCiclo - gastosCiclo
        const pctGastadoCiclo = ingresosCiclo > 0
          ? Math.min((gastosCiclo / ingresosCiclo) * 100, 100)
          : 0

        // Inversión vs ahorro
        const fijosSinInversion = fijos.filter(f => !f.es_inversion)
        const totalFijosSinInv  = fijosSinInversion.reduce((s, f) => s + Number(f.importe), 0)
        const aportadoETFsCiclo = fijos.filter(f => f.es_inversion).reduce((s, f) => s + Number(f.importe), 0)

        const fijosPagados    = fijos.filter(f => !f.es_inversion && f.pagado_ciclo)
                                     .reduce((s, f) => s + Number(f.importe), 0)
        const fijosPendientes = fijos.filter(f => !f.es_inversion && !f.pagado_ciclo)
                                     .reduce((s, f) => s + Number(f.importe), 0)

        const ahorroObjetivo = Number(mesActual?.ahorro_objetivo || 0)

        const ocioGastado = txCiclo
          .filter(t => t.tipo === '⬇ Gasto' && /^(Ocio|Restaurantes)$/i.test(t.categoria || ''))
          .reduce((s, t) => s + Math.abs(Number(t.importe)), 0)

        const saldoRealProyect  = saldoCiclo - fijosPendientes - ahorroObjetivo
        const disponibleOcio    = ingresosCiclo - totalFijosSinInv - aportadoETFsCiclo - ahorroObjetivo - ocioGastado
        const ocioXdia          = diasRestantes > 0 ? disponibleOcio / diasRestantes : disponibleOcio

        // Agrupación por categoría
        const porCat = {}
        txCiclo.filter(t => t.tipo === '⬇ Gasto').forEach(t => {
          const cat = t.categoria || 'Sin categoría'
          porCat[cat] = (porCat[cat] || 0) + Math.abs(Number(t.importe))
        })
        const catOrdenadas = Object.entries(porCat).sort((a, b) => b[1] - a[1])

        return (
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '20px', marginTop: '20px',
          }}>
            {/* Cabecera con navegación */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <button onClick={() => setCicloOffset(o => o - 1)} style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
                color: 'var(--text)', fontSize: '14px',
              }}>←</button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '15px', fontWeight: '600' }}>
                  📆 Ciclo de nómina
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
                  {fmtDia(inicio)} → {fmtDia(fin)}
                  {esCicloActual && <span style={{ marginLeft: '6px', color: 'var(--blue)' }}>· actual</span>}
                </div>
              </div>
              <button
                onClick={() => setCicloOffset(o => o + 1)}
                disabled={cicloOffset >= 0}
                style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '6px 12px',
                  cursor: cicloOffset >= 0 ? 'not-allowed' : 'pointer',
                  color: cicloOffset >= 0 ? 'var(--text2)' : 'var(--text)', fontSize: '14px',
                  opacity: cicloOffset >= 0 ? 0.4 : 1,
                }}>→</button>
            </div>

            {loadingCiclo ? (
              <div style={{ textAlign: 'center', color: 'var(--text2)', padding: '20px' }}>Cargando...</div>
            ) : (
              <>
                {/* Tarjetas resumen */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {[
                    { label: '⬆ Ingresos', value: ingresosCiclo, color: 'var(--green)' },
                    { label: '⬇ Gastos', value: gastosCiclo, color: 'var(--red)' },
                    { label: '💾 Saldo', value: saldoCiclo, color: saldoCiclo >= 0 ? 'var(--blue)' : 'var(--red)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      flex: 1, minWidth: '120px', background: 'var(--bg3)',
                      borderRadius: '12px', padding: '14px',
                    }}>
                      <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '6px' }}>{label}</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color }}>
                        {label === '💾 Saldo' && saldoCiclo > 0 ? '+' : ''}{fmt(value)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Barra de progreso gastos/ingresos */}
                {ingresosCiclo > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>
                      <span>{pctGastadoCiclo.toFixed(0)}% de ingresos gastado</span>
                      <span>
                        {esCicloActual
                          ? `Día ${diasTranscurridos} de ${diasTotales} · quedan ${diasRestantes} días`
                          : `Ciclo cerrado (${diasTotales} días)`}
                      </span>
                    </div>
                    <div style={{ background: 'var(--bg3)', borderRadius: '99px', height: '8px' }}>
                      <div style={{
                        width: `${pctGastadoCiclo}%`, height: '8px', borderRadius: '99px',
                        background: pctGastadoCiclo > 90 ? 'var(--red)' : pctGastadoCiclo > 70 ? 'var(--yellow)' : 'var(--green)',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                )}

                {/* Tarjetas ciclo extendidas */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <div style={{ flex: 1, minWidth: '120px', background: 'var(--bg3)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '6px' }}>🔒 Fijos pendientes</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: fijosPendientes > 0 ? 'var(--red)' : 'var(--green)' }}>
                      {fmt(fijosPendientes)}
                    </div>
                    {fijosPagados > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--green)', marginTop: '3px' }}>
                        ✓ pagado: {fmt(fijosPagados)}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: '120px', background: 'var(--bg3)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '6px' }}>📊 Saldo real proyectado</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: saldoRealProyect >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {saldoRealProyect >= 0 ? '+' : ''}{fmt(saldoRealProyect)}
                    </div>
                    {ahorroObjetivo > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '3px' }}>
                        reserva: {fmt(ahorroObjetivo)}
                      </div>
                    )}
                  </div>
                  <div style={{
                    flex: 1, minWidth: '120px', borderRadius: '12px', padding: '14px',
                    background: disponibleOcio < 0 ? 'rgba(239,68,68,0.1)' : 'var(--bg3)',
                    border: disponibleOcio < 0 ? '1px solid var(--red)' : '1px solid transparent',
                  }}>
                    <div style={{ fontSize: '11px', color: disponibleOcio < 0 ? 'var(--red)' : 'var(--text2)', marginBottom: '6px' }}>
                      🎉 Para mí (ocio)
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: disponibleOcio >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {disponibleOcio >= 0 ? '+' : ''}{fmt(disponibleOcio)}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '3px' }}>
                      {diasRestantes > 0
                        ? `${ocioXdia >= 0 ? '+' : ''}${fmt(ocioXdia)}/día · ${diasRestantes}d restantes`
                        : `gastado en ocio: ${fmt(ocioGastado)}`}
                    </div>
                    {disponibleOcio < 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--red)', marginTop: '4px', fontWeight: '600' }}>
                        ⚠️ Te has pasado del presupuesto de ocio
                      </div>
                    )}
                  </div>
                </div>

                {/* Desglose por categoría */}
                {catOrdenadas.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '10px' }}>Gastos por categoría</div>
                    {catOrdenadas.map(([cat, total]) => {
                      const pct = gastosCiclo > 0 ? (total / gastosCiclo) * 100 : 0
                      return (
                        <div key={cat} style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                            <span>{cat}</span>
                            <span style={{ color: 'var(--text2)' }}>{fmt(total)} · {pct.toFixed(0)}%</span>
                          </div>
                          <div style={{ background: 'var(--bg3)', borderRadius: '99px', height: '5px' }}>
                            <div style={{
                              width: `${pct}%`, height: '5px', borderRadius: '99px',
                              background: 'var(--red)', transition: 'width 0.4s ease',
                            }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Últimas transacciones del ciclo */}
                {txCiclo.length > 0 && (
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>
                      Movimientos ({txCiclo.length})
                    </div>
                    {txCiclo.slice(0, 8).map((t, i) => {
                      const esIngresoNoContado = t.tipo === '⬆ Ingreso' && t.cuentas?.tipo !== 'corriente'
                      return (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '13px',
                          opacity: esIngresoNoContado ? 0.45 : 1,
                        }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                            <span style={{ color: 'var(--text2)', whiteSpace: 'nowrap', fontSize: '11px' }}>{t.fecha}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.descripcion || t.tipo}
                              {esIngresoNoContado && <span style={{ fontSize: '10px', color: 'var(--text2)', marginLeft: '4px' }}>(transferencia)</span>}
                            </span>
                          </div>
                          <span style={{
                            fontWeight: '600', whiteSpace: 'nowrap', marginLeft: '12px',
                            color: t.tipo === '⬆ Ingreso' ? 'var(--green)' : 'var(--red)',
                          }}>
                            {t.tipo === '⬆ Ingreso' ? '+' : '-'}{fmt(Math.abs(t.importe))}
                          </span>
                        </div>
                      )
                    })}
                    {txCiclo.length > 8 && (
                      <div style={{ fontSize: '12px', color: 'var(--text2)', paddingTop: '8px', textAlign: 'center' }}>
                        ...y {txCiclo.length - 8} más
                      </div>
                    )}
                  </div>
                )}

                {txCiclo.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text2)', padding: '20px', fontSize: '13px' }}>
                    No hay transacciones en este ciclo
                  </div>
                )}
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}